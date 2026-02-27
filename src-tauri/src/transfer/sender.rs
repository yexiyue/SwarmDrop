//! 发送方会话
//!
//! 管理单个发送传输的生命周期：响应 ChunkRequest、处理 Complete/Cancel。
//! 文件读取通过 [`file_source`](crate::file_source) 模块完成，加密使用 [`TransferCrypto`]。
//! 使用 `Arc<std::sync::Mutex<ProgressTracker>>` 实现并发安全的进度追踪。

use std::sync::{Arc, Mutex};
use std::time::Instant;

use tauri::AppHandle;
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};
use uuid::Uuid;

use crate::file_source::calc_total_chunks;
use crate::protocol::TransferResponse;
use crate::transfer::crypto::TransferCrypto;
use crate::transfer::offer::PreparedFile;
use crate::transfer::progress::{FileDesc, ProgressTracker, TransferDirection};
use crate::{AppError, AppResult};

/// 发送方会话
pub struct SendSession {
    /// 传输会话 ID
    pub session_id: Uuid,
    /// 准备好的文件列表（含文件来源）
    files: Vec<PreparedFile>,
    /// 加密器
    crypto: TransferCrypto,
    /// Tauri 应用句柄（文件读取时传递给 FileSource + 进度事件发射）
    app: AppHandle,
    /// 进度追踪器（Arc<Mutex> 供并发 ChunkRequest 任务共享）
    progress: Arc<Mutex<ProgressTracker>>,
    /// 取消令牌
    cancel_token: CancellationToken,
    /// 会话创建时间（用于统计传输耗时）
    created_at: Instant,
}

impl SendSession {
    pub fn new(
        session_id: Uuid,
        files: Vec<PreparedFile>,
        key: &[u8; 32],
        app: AppHandle,
    ) -> Self {
        let total_bytes: u64 = files.iter().map(|f| f.size).sum();
        let total_files = files.len();

        let mut tracker =
            ProgressTracker::new(session_id, TransferDirection::Send, total_bytes, total_files);

        // 初始化 per-file 追踪
        let file_descs: Vec<FileDesc> = files
            .iter()
            .map(|f| FileDesc {
                file_id: f.file_id,
                name: f.name.clone(),
                size: f.size,
            })
            .collect();
        tracker.init_files(&file_descs);

        Self {
            session_id,
            files,
            crypto: TransferCrypto::new(key),
            app,
            progress: Arc::new(Mutex::new(tracker)),
            cancel_token: CancellationToken::new(),
            created_at: Instant::now(),
        }
    }

    /// 获取传输耗时（毫秒）
    pub fn elapsed_ms(&self) -> u64 {
        self.created_at.elapsed().as_millis() as u64
    }

    /// 获取已发送总字节数（从 ProgressTracker 读取）
    pub fn total_bytes_sent(&self) -> u64 {
        self.progress
            .lock()
            .map(|p| p.transferred_bytes())
            .unwrap_or(0)
    }

    /// 处理 ChunkRequest：读取文件分块 → 加密 → 上报进度 → 返回 Chunk 响应
    pub async fn handle_chunk_request(
        &self,
        file_id: u32,
        chunk_index: u32,
    ) -> AppResult<TransferResponse> {
        if self.cancel_token.is_cancelled() {
            return Err(AppError::Transfer("传输已取消".into()));
        }

        let file = self
            .files
            .iter()
            .find(|f| f.file_id == file_id)
            .ok_or_else(|| {
                AppError::Transfer(format!("文件不存在: file_id={file_id}"))
            })?;

        // 通过 FileSource 异步读取分块（内部已处理 spawn_blocking）
        let plaintext = file.source.read_chunk(file.size, chunk_index, &self.app).await?;

        let plaintext_len = plaintext.len() as u64;

        // 加密
        let data = self
            .crypto
            .encrypt_chunk(&self.session_id, file_id, chunk_index, &plaintext)
            .map_err(|e| AppError::Transfer(format!("加密失败: {e}")))?;

        // 上报进度（锁内操作极短：VecDeque push + 200ms 节流检查）
        if let Ok(mut p) = self.progress.lock() {
            p.add_bytes(plaintext_len);
            p.update_file_chunk(file_id, plaintext_len);
            p.emit_progress(&self.app);
        }

        // 计算 is_last
        let total_chunks = calc_total_chunks(file.size);
        let is_last = chunk_index + 1 >= total_chunks;

        Ok(TransferResponse::Chunk {
            session_id: self.session_id,
            file_id,
            chunk_index,
            data,
            is_last,
        })
    }

    /// 处理 Complete：记录日志，会话将由 TransferManager 清理
    pub fn handle_complete(&self) {
        info!(
            "Transfer complete acknowledged: session={}",
            self.session_id
        );
    }

    /// 处理 Cancel：取消所有进行中的操作
    pub fn handle_cancel(&self) {
        warn!(
            "Transfer cancelled by peer: session={}",
            self.session_id
        );
        self.cancel_token.cancel();
    }

    /// 获取取消令牌（供外部检查是否已取消）
    pub fn cancel_token(&self) -> &CancellationToken {
        &self.cancel_token
    }

    /// 主动取消
    pub fn cancel(&self) {
        self.cancel_token.cancel();
    }
}
