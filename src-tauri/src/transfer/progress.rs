use std::collections::VecDeque;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::events;
use crate::file_source::calc_total_chunks;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TransferDirection {
    Send,
    Receive,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FileTransferStatus {
    Pending,
    Transferring,
    Completed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileProgressInfo {
    pub file_id: u32,
    pub name: String,
    pub size: u64,
    pub transferred: u64,
    pub status: FileTransferStatus,
    #[serde(skip)]
    pub chunks_done: u32,
    #[serde(skip)]
    pub total_chunks: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgressEvent {
    pub session_id: Uuid,
    pub direction: TransferDirection,
    pub total_files: usize,
    pub completed_files: usize,
    pub total_bytes: u64,
    pub transferred_bytes: u64,
    pub speed: f64,
    pub eta: Option<f64>,
    pub files: Vec<FileProgressInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferCompleteEvent {
    pub session_id: Uuid,
    pub direction: TransferDirection,
    pub total_bytes: u64,
    pub elapsed_ms: u64,
    pub save_path: Option<String>,
    /// Android 端已保存文件的 FileUri 列表（桌面端为空数组）
    pub file_uris: Vec<Value>,
    /// Android 端保存目录的 FileUri（桌面端为 null）
    pub save_dir_uri: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferFailedEvent {
    pub session_id: Uuid,
    pub direction: TransferDirection,
    pub error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferDbErrorEvent {
    pub session_id: Uuid,
    pub message: String,
}

pub struct FileDesc {
    pub file_id: u32,
    pub name: String,
    pub size: u64,
}

pub struct ProgressTracker {
    session_id: Uuid,
    direction: TransferDirection,
    total_bytes: u64,
    transferred_bytes: u64,
    total_files: usize,
    completed_files: usize,
    files: Vec<FileProgressInfo>,
    started_at: Instant,
    samples: VecDeque<(Instant, u64)>,
    last_emit: Option<Instant>,
}

/// 节流间隔
const THROTTLE_INTERVAL: Duration = Duration::from_millis(200);
/// 速度计算滑动窗口
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

    pub fn init_files(&mut self, file_descs: &[FileDesc]) {
        self.init_files_with_resume(file_descs, &std::collections::HashMap::new());
    }

    /// 初始化 per-file 进度，支持断点续传恢复状态。
    /// `resume_state` 为每个文件的已完成 chunk 数和已传输字节数，首次传输传空 map。
    pub fn init_files_with_resume(
        &mut self,
        file_descs: &[FileDesc],
        resume_state: &std::collections::HashMap<u32, (u32, u64)>,
    ) {
        self.files = file_descs
            .iter()
            .map(|f| {
                let total_chunks = calc_total_chunks(f.size);
                let (chunks_done, transferred) =
                    resume_state.get(&f.file_id).copied().unwrap_or((0, 0));
                let status = if chunks_done >= total_chunks {
                    FileTransferStatus::Completed
                } else if chunks_done > 0 {
                    FileTransferStatus::Transferring
                } else {
                    FileTransferStatus::Pending
                };
                FileProgressInfo {
                    file_id: f.file_id,
                    name: f.name.clone(),
                    size: f.size,
                    transferred,
                    status,
                    chunks_done,
                    total_chunks,
                }
            })
            .collect();

        self.completed_files = self
            .files
            .iter()
            .filter(|f| f.status == FileTransferStatus::Completed)
            .count();
        self.transferred_bytes = self.files.iter().map(|f| f.transferred).sum();
    }

    /// 累加分块进度。首次调用时将文件标记为 Transferring，完成时标记为 Completed。
    pub fn update_file_chunk(&mut self, file_id: u32, chunk_bytes: u64) {
        if let Some(f) = self.files.iter_mut().find(|f| f.file_id == file_id) {
            if f.status == FileTransferStatus::Completed {
                return;
            }
            if f.status == FileTransferStatus::Pending {
                f.status = FileTransferStatus::Transferring;
            }
            f.transferred += chunk_bytes;
            f.chunks_done += 1;
            if f.chunks_done >= f.total_chunks {
                f.status = FileTransferStatus::Completed;
                f.transferred = f.size;
                self.completed_files += 1;
            }
        }
    }

    pub fn set_file_transferring(&mut self, file_id: u32) {
        if let Some(f) = self.files.iter_mut().find(|f| f.file_id == file_id) {
            if f.status == FileTransferStatus::Pending {
                f.status = FileTransferStatus::Transferring;
            }
        }
    }

    pub fn transferred_bytes(&self) -> u64 {
        self.transferred_bytes
    }

    pub fn add_bytes(&mut self, bytes: u64) {
        self.transferred_bytes += bytes;
        let now = Instant::now();
        self.samples.push_back((now, self.transferred_bytes));

        let cutoff = now - SPEED_WINDOW;
        while self.samples.front().is_some_and(|(t, _)| *t < cutoff) {
            self.samples.pop_front();
        }
    }

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

    pub fn eta(&self) -> Option<f64> {
        let speed = self.speed();
        if speed < 1.0 {
            return None;
        }
        let remaining = self.total_bytes.saturating_sub(self.transferred_bytes);
        Some(remaining as f64 / speed)
    }

    pub fn elapsed_ms(&self) -> u64 {
        self.started_at.elapsed().as_millis() as u64
    }

    pub fn emit_progress(&mut self, app: &AppHandle) {
        let now = Instant::now();
        if self.last_emit.is_some_and(|last| now.duration_since(last) < THROTTLE_INTERVAL) {
            return;
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

    pub fn emit_failed(&self, app: &AppHandle, error: String) {
        let event = TransferFailedEvent {
            session_id: self.session_id,
            direction: self.direction,
            error,
        };
        let _ = app.emit(events::TRANSFER_FAILED, &event);
    }
}
