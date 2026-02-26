//! 接收方会话
//!
//! 管理单个接收传输的生命周期：并发拉取分块、解密写入、校验、完成确认。
//! 文件写入通过 [`PartFile`](crate::file_sink::PartFile) 的 OOP 方法完成，
//! 加密使用 [`TransferCrypto`]。
//! 使用 Semaphore 控制并发度（8 并发），CancellationToken 支持取消。

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

use swarm_p2p_core::libp2p::PeerId;
use tauri::AppHandle;
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
use crate::transfer::progress::{CurrentFileProgress, ProgressTracker};
use crate::{AppError, AppResult};

/// 最大并发拉取数
const MAX_CONCURRENT_CHUNKS: usize = 8;

/// 单个分块最大重试次数
const MAX_CHUNK_RETRIES: u32 = 3;

/// 重试基础延迟
const RETRY_DELAY_BASE_MS: u64 = 500;

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

        let progress = Arc::new(Mutex::new(ProgressTracker::new(
            self.session_id,
            "receive",
            self.total_size,
            self.files.len(),
        )));

        for file_info in &self.files {
            if self.cancel_token.is_cancelled() {
                let p = progress.lock().await;
                p.emit_failed(&self.app, "用户取消".into());
                return Ok(());
            }

            let total_chunks = calc_total_chunks(file_info.size);

            // 更新进度：设置当前文件
            {
                let mut p = progress.lock().await;
                p.set_current_file(CurrentFileProgress {
                    file_id: file_info.file_id,
                    name: file_info.name.clone(),
                    size: file_info.size,
                    transferred: 0,
                    chunks_completed: 0,
                    total_chunks,
                });
                p.emit_progress(&self.app);
            }

            // 通过 FileSink 创建带缓存句柄的 PartFile
            let part_file = Arc::new(
                self.sink
                    .create_part_file(&file_info.relative_path, file_info.size, &self.app)
                    .await?,
            );

            // 跟踪已创建的临时文件（用于取消时清理）
            self.created_parts.lock().await.push(part_file.clone());

            // 并发拉取分块（写入通过 PartFile::write_chunk 完成）
            let pull_result = self
                .pull_file_chunks(file_info, total_chunks, &part_file, &progress)
                .await;

            if let Err(e) = pull_result {
                part_file.cleanup(&self.app).await;
                self.remove_created_part(&part_file).await;
                let p = progress.lock().await;
                p.emit_failed(&self.app, e.to_string());
                return Err(e);
            }

            // 校验 BLAKE3 并最终化（内部自动关闭写入句柄）
            match part_file
                .verify_and_finalize(&file_info.checksum, &self.app)
                .await
            {
                Ok(_final_path) => {
                    // 文件已最终化，从跟踪列表移除
                    self.remove_created_part(&part_file).await;
                    // 更新进度
                    let mut p = progress.lock().await;
                    p.complete_file();
                    p.emit_progress(&self.app);
                }
                Err(e) => {
                    self.remove_created_part(&part_file).await;
                    let msg = format!(
                        "文件校验失败: {} (file_id={})",
                        file_info.name, file_info.file_id
                    );
                    let p = progress.lock().await;
                    p.emit_failed(&self.app, msg.clone());
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

        // 发射完成事件
        let p = progress.lock().await;
        p.emit_complete(&self.app, Some(self.sink.save_dir_display().into_owned()));

        Ok(())
    }

    /// 并发拉取单个文件的所有分块
    async fn pull_file_chunks(
        self: &Arc<Self>,
        file_info: &FileInfo,
        total_chunks: u32,
        part_file: &Arc<PartFile>,
        progress: &Arc<Mutex<ProgressTracker>>,
    ) -> AppResult<()> {
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_CHUNKS));
        let chunks_completed = Arc::new(AtomicU32::new(0));
        let file_transferred = Arc::new(std::sync::atomic::AtomicU64::new(0));
        let error_flag = Arc::new(tokio::sync::Mutex::new(None::<AppError>));

        let mut handles = Vec::with_capacity(total_chunks as usize);

        for chunk_index in 0..total_chunks {
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
            let chunks_done = chunks_completed.clone();
            let file_trans = file_transferred.clone();
            let err_flag = error_flag.clone();
            let cancel = self.cancel_token.clone();

            let handle = tokio::spawn(async move {
                let _permit = permit;

                if cancel.is_cancelled() {
                    return;
                }

                // 检查是否已有错误
                if err_flag.lock().await.is_some() {
                    return;
                }

                let result = session
                    .pull_single_chunk(file_id, chunk_index, &part_file)
                    .await;

                match result {
                    Ok(chunk_size) => {
                        let done = chunks_done.fetch_add(1, Ordering::Relaxed) + 1;
                        let transferred =
                            file_trans.fetch_add(chunk_size as u64, Ordering::Relaxed)
                                + chunk_size as u64;

                        let mut p = progress.lock().await;
                        p.add_bytes(chunk_size as u64);
                        p.update_current_chunks(done, transferred);
                        p.emit_progress(&session.app);
                    }
                    Err(e) => {
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

    /// 从跟踪列表中移除指定的 PartFile（通过 Arc 指针比较）
    async fn remove_created_part(&self, part_file: &Arc<PartFile>) {
        let mut parts = self.created_parts.lock().await;
        parts.retain(|p| !Arc::ptr_eq(p, part_file));
    }
}
