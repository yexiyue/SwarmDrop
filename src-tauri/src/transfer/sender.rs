//! 发送方会话
//!
//! 管理单个发送传输的生命周期：响应 ChunkRequest、处理 Complete/Cancel。
//! 文件读取在 `spawn_blocking` 中执行，加密使用 [`TransferCrypto`]。

use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use tokio_util::sync::CancellationToken;
use tracing::{info, warn};

use crate::protocol::TransferResponse;
use crate::transfer::crypto::TransferCrypto;
use crate::transfer::offer::PreparedFile;
use crate::{AppError, AppResult};

/// 分块大小：256 KB
pub const CHUNK_SIZE: usize = 256 * 1024;

/// 发送方会话
pub struct SendSession {
    /// 传输会话 ID
    pub session_id: String,
    /// 准备好的文件列表（含绝对路径）
    files: Vec<PreparedFile>,
    /// 加密器
    crypto: TransferCrypto,
    /// 取消令牌
    cancel_token: CancellationToken,
    /// 会话创建时间（用于统计传输耗时）
    created_at: Instant,
    /// 已发送字节数（原子计数）
    bytes_sent: AtomicU64,
}

impl SendSession {
    pub fn new(
        session_id: String,
        files: Vec<PreparedFile>,
        key: &[u8; 32],
    ) -> Self {
        Self {
            session_id,
            files,
            crypto: TransferCrypto::new(key),
            cancel_token: CancellationToken::new(),
            created_at: Instant::now(),
            bytes_sent: AtomicU64::new(0),
        }
    }

    /// 获取传输的总字节数
    pub fn total_bytes_sent(&self) -> u64 {
        self.bytes_sent.load(Ordering::Relaxed)
    }

    /// 获取传输耗时（毫秒）
    pub fn elapsed_ms(&self) -> u64 {
        self.created_at.elapsed().as_millis() as u64
    }

    /// 处理 ChunkRequest：读取文件分块 → 加密 → 返回 Chunk 响应
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

        let path = file.absolute_path.clone();
        let size = file.size;
        let session_id = self.session_id.clone();

        // 在 blocking 线程中读取文件分块
        let plaintext = tokio::task::spawn_blocking(move || {
            read_chunk(&path, size, chunk_index)
        })
        .await??;

        // 统计已发送字节数
        self.bytes_sent
            .fetch_add(plaintext.len() as u64, Ordering::Relaxed);

        // 加密
        let data = self
            .crypto
            .encrypt_chunk(&session_id, file_id, chunk_index, &plaintext)
            .map_err(|e| AppError::Transfer(format!("加密失败: {e}")))?;

        // 计算 is_last
        let total_chunks = calc_total_chunks(size);
        let is_last = chunk_index + 1 >= total_chunks;

        Ok(TransferResponse::Chunk {
            session_id: self.session_id.clone(),
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

/// 同步读取文件的指定分块
fn read_chunk(path: &str, file_size: u64, chunk_index: u32) -> AppResult<Vec<u8>> {
    use std::io::{Read, Seek, SeekFrom};

    let offset = chunk_index as u64 * CHUNK_SIZE as u64;
    if offset >= file_size {
        return Err(AppError::Transfer(format!(
            "chunk_index 超出范围: offset={offset}, file_size={file_size}"
        )));
    }

    let remaining = file_size - offset;
    let read_size = (remaining as usize).min(CHUNK_SIZE);

    let mut file = std::fs::File::open(Path::new(path))?;
    file.seek(SeekFrom::Start(offset))?;

    let mut buf = vec![0u8; read_size];
    file.read_exact(&mut buf)?;

    Ok(buf)
}

/// 计算文件的总分块数
pub fn calc_total_chunks(file_size: u64) -> u32 {
    if file_size == 0 {
        return 1; // 空文件也算一个块
    }
    file_size.div_ceil(CHUNK_SIZE as u64) as u32
}
