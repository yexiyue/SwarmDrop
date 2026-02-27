//! 进度追踪模块
//!
//! 提供滑动窗口速度计算、per-file 进度追踪和节流进度事件发射。

use std::collections::VecDeque;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::events;
use crate::file_source::calc_total_chunks;

/// 传输方向
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TransferDirection {
    Send,
    Receive,
    Unknown,
}

/// 文件传输状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FileTransferStatus {
    Pending,
    Transferring,
    Completed,
}

/// 单个文件的进度信息
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileProgressInfo {
    pub file_id: u32,
    pub name: String,
    pub size: u64,
    pub transferred: u64,
    pub status: FileTransferStatus,
    /// 已完成的分块数（内部追踪，不序列化给前端）
    #[serde(skip)]
    pub chunks_done: u32,
    /// 总分块数（内部追踪，不序列化给前端）
    #[serde(skip)]
    pub total_chunks: u32,
}

/// 进度事件 payload（推送给前端）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgressEvent {
    pub session_id: Uuid,
    pub direction: TransferDirection,
    pub total_files: usize,
    pub completed_files: usize,
    pub total_bytes: u64,
    pub transferred_bytes: u64,
    /// bytes/sec
    pub speed: f64,
    /// 预计剩余秒数
    pub eta: Option<f64>,
    /// 每个文件的独立进度
    pub files: Vec<FileProgressInfo>,
}

/// 传输完成事件
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferCompleteEvent {
    pub session_id: Uuid,
    pub direction: TransferDirection,
    pub total_bytes: u64,
    pub elapsed_ms: u64,
    pub save_path: Option<String>,
    /// Android 端已保存文件的 FileUri 列表（桌面端为空数组）
    ///
    /// 使用 `serde_json::Value` 避免跨平台编译问题（FileUri 仅 Android 可用），
    /// 前端直接作为 `AndroidFsUri[]` 使用。
    pub file_uris: Vec<Value>,
    /// Android 端保存目录的 FileUri（桌面端为 null）
    ///
    /// 通过 `resolve_initial_location` 获取的标准 content URI，
    /// 前端可直接传给 `showViewDirDialog`。
    pub save_dir_uri: Option<Value>,
}

/// 传输失败事件
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferFailedEvent {
    pub session_id: Uuid,
    pub direction: TransferDirection,
    pub error: String,
}

/// 用于初始化 per-file 追踪的文件描述
pub struct FileDesc {
    pub file_id: u32,
    pub name: String,
    pub size: u64,
}

/// 进度追踪器
pub struct ProgressTracker {
    session_id: Uuid,
    direction: TransferDirection,
    total_bytes: u64,
    transferred_bytes: u64,
    total_files: usize,
    completed_files: usize,
    /// 每个文件的进度状态
    files: Vec<FileProgressInfo>,
    started_at: Instant,
    /// 滑动窗口采样点
    samples: VecDeque<(Instant, u64)>,
    /// 上次发射进度事件的时间
    last_emit: Option<Instant>,
}

/// 节流间隔：200ms
const THROTTLE_INTERVAL: Duration = Duration::from_millis(200);
/// 速度计算滑动窗口：3 秒
const SPEED_WINDOW: Duration = Duration::from_secs(3);

impl ProgressTracker {
    pub fn new(
        session_id: Uuid,
        direction: TransferDirection,
        total_bytes: u64,
        total_files: usize,
    ) -> Self {
        Self {
            session_id,
            direction,
            total_bytes,
            transferred_bytes: 0,
            total_files,
            completed_files: 0,
            files: Vec::new(),
            started_at: Instant::now(),
            samples: VecDeque::new(),
            last_emit: None,
        }
    }

    /// 从文件列表初始化 per-file 状态（全部 pending）
    pub fn init_files(&mut self, file_descs: &[FileDesc]) {
        self.files = file_descs
            .iter()
            .map(|f| FileProgressInfo {
                file_id: f.file_id,
                name: f.name.clone(),
                size: f.size,
                transferred: 0,
                status: FileTransferStatus::Pending,
                chunks_done: 0,
                total_chunks: calc_total_chunks(f.size),
            })
            .collect();
    }

    /// 更新指定文件的分块进度
    ///
    /// 按 file_id 累加 transferred 字节、递增 chunks_done。
    /// 首次调用时自动将文件标记为 "transferring"。
    /// 当 chunks_done == total_chunks 时自动标记为 "completed"。
    pub fn update_file_chunk(&mut self, file_id: u32, chunk_bytes: u64) {
        if let Some(f) = self.files.iter_mut().find(|f| f.file_id == file_id) {
            if f.status == FileTransferStatus::Pending {
                f.status = FileTransferStatus::Transferring;
            }
            f.transferred += chunk_bytes;
            f.chunks_done += 1;
            if f.chunks_done >= f.total_chunks {
                f.status = FileTransferStatus::Completed;
                f.transferred = f.size; // 确保精确
                self.completed_files += 1;
            }
        }
    }

    /// 将指定文件标记为 "transferring"
    pub fn set_file_transferring(&mut self, file_id: u32) {
        if let Some(f) = self.files.iter_mut().find(|f| f.file_id == file_id) {
            if f.status == FileTransferStatus::Pending {
                f.status = FileTransferStatus::Transferring;
            }
        }
    }

    /// 获取已传输字节数
    pub fn transferred_bytes(&self) -> u64 {
        self.transferred_bytes
    }

    /// 记录传输的字节数
    pub fn add_bytes(&mut self, bytes: u64) {
        self.transferred_bytes += bytes;
        let now = Instant::now();
        self.samples.push_back((now, self.transferred_bytes));

        // 清理超出窗口的采样点
        let cutoff = now - SPEED_WINDOW;
        while self
            .samples
            .front()
            .is_some_and(|(t, _)| *t < cutoff)
        {
            self.samples.pop_front();
        }
    }

    /// 计算速度（bytes/sec）
    pub fn speed(&self) -> f64 {
        if self.samples.len() < 2 {
            return 0.0;
        }
        let (t_first, b_first) = self.samples.front().unwrap();
        let (t_last, b_last) = self.samples.back().unwrap();
        let elapsed = t_last.duration_since(*t_first).as_secs_f64();
        if elapsed < 0.001 {
            return 0.0;
        }
        (b_last - b_first) as f64 / elapsed
    }

    /// 计算 ETA（秒）
    pub fn eta(&self) -> Option<f64> {
        let speed = self.speed();
        if speed < 1.0 {
            return None;
        }
        let remaining = self.total_bytes.saturating_sub(self.transferred_bytes);
        Some(remaining as f64 / speed)
    }

    /// 已用时间（毫秒）
    pub fn elapsed_ms(&self) -> u64 {
        self.started_at.elapsed().as_millis() as u64
    }

    /// 节流发射进度事件（200ms 间隔）
    pub fn emit_progress(&mut self, app: &AppHandle) {
        let now = Instant::now();
        if let Some(last) = self.last_emit {
            if now.duration_since(last) < THROTTLE_INTERVAL {
                return;
            }
        }
        self.last_emit = Some(now);

        let event = TransferProgressEvent {
            session_id: self.session_id,
            direction: self.direction,
            total_files: self.total_files,
            completed_files: self.completed_files,
            total_bytes: self.total_bytes,
            transferred_bytes: self.transferred_bytes,
            speed: self.speed(),
            eta: self.eta(),
            files: self.files.clone(),
        };
        let _ = app.emit(events::TRANSFER_PROGRESS, &event);
    }

    /// 发射传输完成事件
    pub fn emit_complete(
        &self,
        app: &AppHandle,
        save_path: Option<String>,
        file_uris: Vec<Value>,
        save_dir_uri: Option<Value>,
    ) {
        let event = TransferCompleteEvent {
            session_id: self.session_id,
            direction: self.direction,
            total_bytes: self.transferred_bytes,
            elapsed_ms: self.elapsed_ms(),
            save_path,
            file_uris,
            save_dir_uri,
        };
        let _ = app.emit(events::TRANSFER_COMPLETE, &event);
    }

    /// 发射传输失败事件
    pub fn emit_failed(&self, app: &AppHandle, error: String) {
        let event = TransferFailedEvent {
            session_id: self.session_id,
            direction: self.direction,
            error,
        };
        let _ = app.emit(events::TRANSFER_FAILED, &event);
    }
}
