//! 接收方会话
//!
//! 管理单个接收传输的生命周期：并发拉取分块、解密写入、校验、完成确认。
//! 文件写入通过 [`PartFile`](crate::file_sink::PartFile) 的 OOP 方法完成，
//! 加密使用 [`TransferCrypto`]。
//! 使用 Semaphore 控制并发度（8 并发），CancellationToken 支持取消。

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;

use sea_orm::DatabaseConnection;
use swarm_p2p_core::libp2p::PeerId;
use tauri::{AppHandle, Manager};
use tokio::sync::{Mutex, Semaphore};
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::file_sink::{FileSink, PartFile};
use crate::file_source::calc_total_chunks;
use crate::protocol::{
    AppNetClient, AppRequest, AppResponse, FileInfo, TransferRequest, TransferResponse,
};
use crate::transfer::crypto::TransferCrypto;
use crate::transfer::progress::{FileDesc, ProgressTracker, TransferDirection};
use crate::{AppError, AppResult};

/// 最大并发拉取数
const MAX_CONCURRENT_CHUNKS: usize = 8;

/// 单个分块最大重试次数
const MAX_CHUNK_RETRIES: u32 = 3;

/// 重试基础延迟
const RETRY_DELAY_BASE_MS: u64 = 500;

/// 每完成多少个 chunk 刷写一次 bitmap checkpoint 到 DB
const CHECKPOINT_INTERVAL: u32 = 10;

/// 接收方会话
pub struct ReceiveSession {
    /// 传输会话 ID
    pub session_id: Uuid,
    /// 发送方 PeerId
    pub peer_id: PeerId,
    /// 文件列表
    files: Vec<FileInfo>,
    /// 总大小
    total_size: u64,
    /// 文件写入目标（工厂：创建 PartFile + 权限检查）
    sink: FileSink,
    /// Tauri AppHandle（用于事件发射和 Android 操作）
    app: AppHandle,
    /// 加密器
    crypto: Arc<TransferCrypto>,
    /// 网络客户端
    client: AppNetClient,
    /// 取消令牌
    cancel_token: CancellationToken,
    /// 已创建的临时文件（用于取消时清理）
    created_parts: Mutex<Vec<Arc<PartFile>>>,
    /// 断点续传初始 bitmap（file_id → completed_chunks bitmap），首次传输为空
    initial_bitmaps: HashMap<u32, Vec<u8>>,
}

impl ReceiveSession {
    #[expect(clippy::too_many_arguments, reason = "传输会话初始化需要完整上下文")]
    pub fn new(
        session_id: Uuid,
        peer_id: PeerId,
        files: Vec<FileInfo>,
        total_size: u64,
        sink: FileSink,
        key: &[u8; 32],
        client: AppNetClient,
        app: AppHandle,
        initial_bitmaps: HashMap<u32, Vec<u8>>,
    ) -> Self {
        Self {
            session_id,
            peer_id,
            files,
            total_size,
            sink,
            app,
            crypto: Arc::new(TransferCrypto::new(key)),
            client,
            cancel_token: CancellationToken::new(),
            created_parts: Mutex::new(Vec::new()),
            initial_bitmaps,
        }
    }

    /// 启动后台拉取任务
    ///
    /// 逐文件、并发分块拉取 → 解密 → 写入 → 校验 → 最终化。
    /// 所有文件完成后发送 Complete 消息给发送方。
    /// `on_finish` 在任务结束（成功或失败）后调用，用于清理 DashMap 中的会话引用。
    pub fn start_pulling<F>(self: Arc<Self>, on_finish: F)
    where
        F: FnOnce(&Uuid) + Send + 'static,
    {
        let session = self;
        tokio::spawn(async move {
            let result = session.run_transfer().await;

            match result {
                Ok(()) => {
                    info!(
                        "Transfer completed successfully: session={}",
                        session.session_id
                    );
                }
                Err(e) => {
                    error!(
                        "Transfer failed: session={}, error={}",
                        session.session_id, e
                    );
                }
            }

            // 通知外部清理会话
            on_finish(&session.session_id);
        });
    }

    /// 主传输逻辑
    async fn run_transfer(self: &Arc<Self>) -> AppResult<()> {
        // Android 端在首次写入前请求存储权限
        self.sink.ensure_permission(&self.app).await?;

        let is_resume = !self.initial_bitmaps.is_empty();

        let mut tracker = ProgressTracker::new(
            self.session_id,
            TransferDirection::Receive,
            self.total_size,
            self.files.len(),
        );

        // 初始化 per-file 追踪（从 bitmap 计算恢复状态，首次传输时为空）
        let file_descs: Vec<FileDesc> = self
            .files
            .iter()
            .map(|f| FileDesc {
                file_id: f.file_id,
                name: f.name.clone(),
                size: f.size,
            })
            .collect();

        let resume_state: HashMap<u32, (u32, u64)> = file_descs
            .iter()
            .filter_map(|f| {
                let bm = self.initial_bitmaps.get(&f.file_id)?;
                let total_chunks = calc_total_chunks(f.size);
                let chunks_done = count_completed_in_bitmap(bm, total_chunks);
                let transferred = bytes_from_bitmap(bm, f.size, total_chunks);
                Some((f.file_id, (chunks_done, transferred)))
            })
            .collect();
        tracker.init_files_with_resume(&file_descs, &resume_state);

        let progress = Arc::new(Mutex::new(tracker));

        // 收集已完成文件的 URI（Android 端用于前端打开文件）
        let mut file_uris: Vec<serde_json::Value> = Vec::new();

        for file_info in &self.files {
            if self.cancel_token.is_cancelled() {
                let p = progress.lock().await;
                p.emit_failed(&self.app, "用户取消".into());
                return Ok(());
            }

            let total_chunks = calc_total_chunks(file_info.size);

            // 断点续传：检查文件是否已被最终化（.part 已重命名为最终文件）
            if is_resume {
                let probe = self.sink.build_part_file(&file_info.relative_path, file_info.size);
                if !probe.final_path.as_os_str().is_empty() && probe.final_path.exists() {
                    info!(
                        "文件已最终化，跳过: {} (file_id={})",
                        file_info.name, file_info.file_id
                    );
                    continue;
                }
            }

            // 获取此文件的初始 bitmap
            let initial_bitmap = self.initial_bitmaps.get(&file_info.file_id);
            let is_fully_complete = initial_bitmap
                .map(|bm| count_completed_in_bitmap(bm, total_chunks) >= total_chunks)
                .unwrap_or(false);

            // 更新进度：标记当前文件为 transferring
            if !is_fully_complete {
                let mut p = progress.lock().await;
                p.set_file_transferring(file_info.file_id);
                p.emit_progress(&self.app);
            }

            // 创建/打开 PartFile
            let part_file = Arc::new(if is_resume {
                self.sink
                    .open_or_create_part_file(&file_info.relative_path, file_info.size, &self.app)
                    .await?
            } else {
                self.sink
                    .create_part_file(&file_info.relative_path, file_info.size, &self.app)
                    .await?
            });

            // 跟踪已创建的临时文件（用于取消时清理）
            self.created_parts.lock().await.push(part_file.clone());

            // 并发拉取未完成的分块
            let pull_result = if is_fully_complete {
                Ok(()) // 所有 chunk 已接收，直接进入校验
            } else {
                self.pull_file_chunks(
                    file_info, total_chunks, &part_file, &progress, initial_bitmap,
                )
                .await
            };

            if let Err(e) = pull_result {
                part_file.cleanup(&self.app).await;
                self.remove_created_part(&part_file).await;
                self.fail_session(&progress, e.to_string()).await;
                return Err(e);
            }

            // 校验 BLAKE3 并最终化（内部自动关闭写入句柄）
            match part_file
                .verify_and_finalize(&file_info.checksum, &self.app)
                .await
            {
                Ok(_final_path) => {
                    // 收集 Android 文件 URI（桌面端返回 None，自动跳过）
                    if let Some(value) = part_file.to_uri_value() {
                        file_uris.push(value);
                    }
                    // 文件已最终化，从跟踪列表移除
                    self.remove_created_part(&part_file).await;
                }
                Err(e) => {
                    self.remove_created_part(&part_file).await;
                    let msg = format!(
                        "文件校验失败: {} (file_id={})",
                        file_info.name, file_info.file_id
                    );
                    self.fail_session(&progress, msg).await;
                    return Err(e);
                }
            }

            info!(
                "File verified and saved: {} (file_id={})",
                file_info.name, file_info.file_id
            );
        }

        // 所有文件完成，发送 Complete 消息
        let complete_result = self
            .client
            .send_request(
                self.peer_id,
                AppRequest::Transfer(TransferRequest::Complete {
                    session_id: self.session_id,
                }),
            )
            .await;

        match complete_result {
            Ok(AppResponse::Transfer(TransferResponse::Ack { .. })) => {
                info!("Transfer complete ack received: session={}", self.session_id);
            }
            Ok(other) => {
                warn!("Unexpected complete response: {:?}", other);
            }
            Err(e) => {
                warn!("Failed to send complete message: {}", e);
            }
        }

        // DB: 标记接收方会话完成
        if let Some(db) = self.app.try_state::<DatabaseConnection>() {
            if let Err(e) =
                crate::database::ops::mark_session_completed(&db, self.session_id).await
            {
                warn!("DB 标记接收完成失败: {}", e);
            }
        }

        // 获取 Android 保存目录 URI（桌面端返回 None）
        let save_dir_uri = self.sink.resolve_save_dir_uri(&self.app).await;

        // 发射完成事件（含 Android 文件 URI 和目录 URI）
        let p = progress.lock().await;
        p.emit_complete(
            &self.app,
            Some(self.sink.save_dir_display().into_owned()),
            file_uris,
            save_dir_uri,
        );

        Ok(())
    }

    /// 并发拉取单个文件的所有分块
    async fn pull_file_chunks(
        self: &Arc<Self>,
        file_info: &FileInfo,
        total_chunks: u32,
        part_file: &Arc<PartFile>,
        progress: &Arc<Mutex<ProgressTracker>>,
        initial_bitmap: Option<&Vec<u8>>,
    ) -> AppResult<()> {
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_CHUNKS));
        let has_error = Arc::new(AtomicBool::new(false));
        let error_flag = Arc::new(tokio::sync::Mutex::new(None::<AppError>));

        // Bitmap checkpoint 追踪（断点续传：从已有 bitmap 恢复）
        let bitmap_len = (total_chunks as usize).div_ceil(8);
        let (bitmap, initial_completed, initial_bytes) = if let Some(bm) = initial_bitmap {
            let completed = count_completed_in_bitmap(bm, total_chunks);
            let bytes = bytes_from_bitmap(bm, file_info.size, total_chunks);
            (Arc::new(tokio::sync::Mutex::new(bm.clone())), completed, bytes)
        } else {
            (Arc::new(tokio::sync::Mutex::new(vec![0u8; bitmap_len])), 0, 0)
        };
        let completed_count = Arc::new(AtomicU32::new(initial_completed));
        let file_transferred = Arc::new(AtomicU64::new(initial_bytes));

        let mut handles = Vec::with_capacity(total_chunks as usize);

        for chunk_index in 0..total_chunks {
            // 跳过已完成的 chunk（断点续传）
            if let Some(bm) = initial_bitmap {
                if is_chunk_completed(bm, chunk_index) {
                    continue;
                }
            }
            // 等待 permit 时同时监听取消，避免取消后仍阻塞在 acquire
            let permit = tokio::select! {
                p = semaphore.clone().acquire_owned() => {
                    p.map_err(|_| AppError::Transfer("Semaphore closed".into()))?
                }
                _ = self.cancel_token.cancelled() => {
                    break;
                }
            };

            let session = self.clone();
            let file_id = file_info.file_id;
            let part_file = part_file.clone();
            let progress = progress.clone();
            let err_flag = error_flag.clone();
            let has_err = has_error.clone();
            let cancel = self.cancel_token.clone();
            let bitmap = bitmap.clone();
            let completed_count = completed_count.clone();
            let file_transferred = file_transferred.clone();

            let handle = tokio::spawn(async move {
                let _permit = permit;

                if cancel.is_cancelled() {
                    return;
                }

                // 快速检查是否已有错误（无锁路径）
                if has_err.load(Ordering::Relaxed) {
                    return;
                }

                let result = session
                    .pull_single_chunk(file_id, chunk_index, &part_file)
                    .await;

                match result {
                    Ok(chunk_size) => {
                        let mut p = progress.lock().await;
                        p.add_bytes(chunk_size as u64);
                        p.update_file_chunk(file_id, chunk_size as u64);
                        p.emit_progress(&session.app);
                        drop(p);

                        // 更新 bitmap（标记此 chunk 完成）
                        {
                            let mut bm = bitmap.lock().await;
                            mark_chunk_completed(&mut bm, chunk_index);
                        }
                        file_transferred.fetch_add(chunk_size as u64, Ordering::Relaxed);

                        // 每 CHECKPOINT_INTERVAL 个 chunk 刷写 bitmap 到 DB
                        let count = completed_count.fetch_add(1, Ordering::Relaxed) + 1;
                        if count.is_multiple_of(CHECKPOINT_INTERVAL) {
                            if let Some(db) = session.app.try_state::<DatabaseConnection>() {
                                let bm = bitmap.lock().await.clone();
                                let bytes =
                                    file_transferred.load(Ordering::Relaxed);
                                if let Err(e) =
                                    crate::database::ops::update_file_checkpoint(
                                        &db,
                                        session.session_id,
                                        file_id as i32,
                                        bm,
                                        bytes as i64,
                                    )
                                    .await
                                {
                                    warn!("Bitmap checkpoint 刷写失败: {}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        has_err.store(true, Ordering::Relaxed);
                        let mut flag = err_flag.lock().await;
                        if flag.is_none() {
                            *flag = Some(e);
                        }
                        cancel.cancel();
                    }
                }
            });

            handles.push(handle);
        }

        // 等待所有任务完成
        for handle in handles {
            let _ = handle.await;
        }

        // 如果被取消/暂停，最终刷写 bitmap（确保进度不丢失）
        if self.cancel_token.is_cancelled() {
            if let Some(db) = self.app.try_state::<DatabaseConnection>() {
                let bm = bitmap.lock().await.clone();
                let bytes = file_transferred.load(Ordering::Relaxed);
                if let Err(e) = crate::database::ops::update_file_checkpoint(
                    &db,
                    self.session_id,
                    file_info.file_id as i32,
                    bm,
                    bytes as i64,
                )
                .await
                {
                    warn!("暂停/取消 bitmap 最终刷写失败: {}", e);
                }
            }
        }

        // 检查错误
        let error = error_flag.lock().await.take();
        if let Some(e) = error {
            return Err(e);
        }

        Ok(())
    }

    /// 拉取单个分块（含重试）
    async fn pull_single_chunk(
        &self,
        file_id: u32,
        chunk_index: u32,
        part_file: &Arc<PartFile>,
    ) -> AppResult<usize> {
        let mut last_error = None;

        for attempt in 0..MAX_CHUNK_RETRIES {
            if self.cancel_token.is_cancelled() {
                return Err(AppError::Transfer("传输已取消".into()));
            }

            if attempt > 0 {
                let delay_ms = RETRY_DELAY_BASE_MS * (1 << (attempt - 1));
                let delay = std::time::Duration::from_millis(delay_ms.min(2000));
                warn!(
                    "Retrying chunk request (attempt {}): file_id={}, chunk_index={}",
                    attempt + 1,
                    file_id,
                    chunk_index
                );
                tokio::time::sleep(delay).await;
            }

            let result = self
                .client
                .send_request(
                    self.peer_id,
                    AppRequest::Transfer(TransferRequest::ChunkRequest {
                        session_id: self.session_id,
                        file_id,
                        chunk_index,
                    }),
                )
                .await;

            match result {
                Ok(AppResponse::Transfer(TransferResponse::Chunk {
                    data, ..
                })) => {
                    // 解密
                    let plaintext = self
                        .crypto
                        .decrypt_chunk(&self.session_id, file_id, chunk_index, &data)
                        .map_err(|e| {
                            AppError::Transfer(format!(
                                "解密失败: file_id={file_id}, chunk={chunk_index}, {e}"
                            ))
                        })?;

                    let chunk_size = plaintext.len();

                    // 通过 PartFile 写入分块（pwrite，并发安全）
                    part_file.write_chunk(chunk_index, &plaintext).await?;

                    return Ok(chunk_size);
                }
                Ok(other) => {
                    last_error = Some(AppError::Transfer(format!(
                        "意外的响应类型: {other:?}"
                    )));
                }
                Err(e) => {
                    last_error = Some(AppError::Transfer(format!(
                        "ChunkRequest 失败: {e}"
                    )));
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            AppError::Transfer(format!(
                "分块重试耗尽: file_id={file_id}, chunk={chunk_index}"
            ))
        }))
    }

    /// 发送 Cancel 消息给发送方
    pub async fn send_cancel(&self) {
        let _ = self
            .client
            .send_request(
                self.peer_id,
                AppRequest::Transfer(TransferRequest::Cancel {
                    session_id: self.session_id,
                    reason: "用户取消".into(),
                }),
            )
            .await;
    }

    /// 主动取消
    pub fn cancel(&self) {
        self.cancel_token.cancel();
    }

    /// 获取取消令牌
    pub fn cancel_token(&self) -> &CancellationToken {
        &self.cancel_token
    }

    /// 清理所有已创建但未最终化的临时文件
    pub async fn cleanup_part_files(&self) {
        let parts = self.created_parts.lock().await;
        for part_file in parts.iter() {
            part_file.cleanup(&self.app).await;
        }
    }

    /// 标记会话失败：写入 DB 失败记录 + 发射失败事件
    async fn fail_session(&self, progress: &Arc<Mutex<ProgressTracker>>, msg: String) {
        if let Some(db) = self.app.try_state::<DatabaseConnection>() {
            let _ =
                crate::database::ops::mark_session_failed(&db, self.session_id, &msg).await;
        }
        let p = progress.lock().await;
        p.emit_failed(&self.app, msg);
    }

    /// 从跟踪列表中移除指定的 PartFile（通过 Arc 指针比较）
    async fn remove_created_part(&self, part_file: &Arc<PartFile>) {
        let mut parts = self.created_parts.lock().await;
        parts.retain(|p| !Arc::ptr_eq(p, part_file));
    }
}

// ============ Bitmap 辅助函数 ============

/// 检查指定 chunk 是否已完成
fn is_chunk_completed(bitmap: &[u8], chunk_index: u32) -> bool {
    let byte_idx = (chunk_index / 8) as usize;
    let bit_idx = chunk_index % 8;
    byte_idx < bitmap.len() && (bitmap[byte_idx] & (1 << bit_idx)) != 0
}

/// 标记指定 chunk 为已完成
fn mark_chunk_completed(bitmap: &mut [u8], chunk_index: u32) {
    let byte_idx = (chunk_index / 8) as usize;
    let bit_idx = chunk_index % 8;
    if byte_idx < bitmap.len() {
        bitmap[byte_idx] |= 1 << bit_idx;
    }
}

/// 统计 bitmap 中已完成的 chunk 数（利用 popcount 加速）
fn count_completed_in_bitmap(bitmap: &[u8], total_chunks: u32) -> u32 {
    let full_bytes = (total_chunks / 8) as usize;
    let remainder_bits = total_chunks % 8;

    let mut count: u32 = bitmap
        .iter()
        .take(full_bytes)
        .map(|b| b.count_ones())
        .sum();

    // 尾部不完整字节：仅统计有效位
    if remainder_bits > 0 {
        if let Some(&last_byte) = bitmap.get(full_bytes) {
            let mask = (1u8 << remainder_bits) - 1;
            count += (last_byte & mask).count_ones();
        }
    }

    count
}

/// 根据 bitmap 计算已传输字节数
fn bytes_from_bitmap(bitmap: &[u8], file_size: u64, total_chunks: u32) -> u64 {
    if file_size == 0 || total_chunks == 0 {
        return 0;
    }
    let chunk_size = crate::file_source::CHUNK_SIZE as u64;
    let last_chunk_size = match file_size % chunk_size {
        0 => chunk_size,
        r => r,
    };

    let full_chunk_count = count_completed_in_bitmap(bitmap, total_chunks.saturating_sub(1));
    let last_chunk_done = is_chunk_completed(bitmap, total_chunks - 1);

    full_chunk_count as u64 * chunk_size
        + if last_chunk_done { last_chunk_size } else { 0 }
}
