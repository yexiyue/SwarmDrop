//! 传输管理器
//!
//! 管理 Offer 协议（发送、接受、拒绝）和活跃传输会话（发送/接收）。
//! 事件循环写入缓存 → 前端操作后通过 Tauri 命令消费缓存。

use std::sync::Arc;

use dashmap::DashMap;
use serde::Serialize;
use swarm_p2p_core::libp2p::PeerId;
use tauri::AppHandle;
use tracing::{info, warn};
use uuid::Uuid;

use crate::file_sink::FileSink;
use crate::file_source::{EnumeratedFile, FileSource};
use crate::protocol::{
    AppNetClient, AppRequest, AppResponse, FileInfo, TransferRequest, TransferResponse,
};
use crate::transfer::crypto::generate_key;
use crate::transfer::receiver::ReceiveSession;
use crate::transfer::sender::SendSession;
use crate::{AppError, AppResult};

/// prepare_send 进度事件（通过 Tauri Channel 实时推送给前端）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareProgress {
    /// 当前正在 hash 的文件名
    pub current_file: String,
    /// 已完成 hash 的文件数
    pub completed_files: u32,
    /// 总文件数
    pub total_files: u32,
    /// 累积已 hash 的字节数（所有文件）
    pub bytes_hashed: u64,
    /// 总字节数（所有文件）
    pub total_bytes: u64,
}

/// 发送方准备好的传输信息
#[derive(Debug, Clone)]
pub struct PreparedTransfer {
    /// 唯一标识符
    pub prepared_id: Uuid,
    /// 文件列表（含 BLAKE3 校验和）
    pub files: Vec<PreparedFile>,
    /// 总大小（字节）
    pub total_size: u64,
}

/// 准备好的单个文件
#[derive(Debug, Clone)]
pub struct PreparedFile {
    /// 文件标识符
    pub file_id: u32,
    /// 文件名
    pub name: String,
    /// 相对路径
    pub relative_path: String,
    /// 文件来源（发送时读取文件用）
    pub source: FileSource,
    /// 文件大小
    pub size: u64,
    /// BLAKE3 校验和（hex）
    pub checksum: String,
}

/// 接收方缓存的入站 Offer
#[derive(Debug)]
pub struct PendingOffer {
    /// libp2p pending request id（回复时使用）
    pending_id: u64,
    /// 发送方 PeerId
    pub peer_id: PeerId,
    /// 传输会话 ID
    pub session_id: Uuid,
    /// 文件列表
    pub files: Vec<FileInfo>,
    /// 总大小
    pub total_size: u64,
}

/// `send_offer` 的返回类型
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSendResult {
    pub session_id: Uuid,
    pub accepted: bool,
    pub reason: Option<String>,
}

/// 传输管理器（原 OfferManager，扩展为管理完整传输生命周期）
pub struct TransferManager {
    /// libp2p 网络客户端
    client: AppNetClient,
    /// 发送方：prepare_send 的缓存（key = prepared_id）
    prepared: DashMap<Uuid, PreparedTransfer>,
    /// 接收方：入站 Offer 的缓存（key = session_id）
    pending: DashMap<Uuid, PendingOffer>,
    /// 活跃的发送会话（key = session_id）
    send_sessions: DashMap<Uuid, Arc<SendSession>>,
    /// 活跃的接收会话（key = session_id, Arc 包装以便回调中清理）
    receive_sessions: Arc<DashMap<Uuid, Arc<ReceiveSession>>>,
}

impl TransferManager {
    pub fn new(client: AppNetClient) -> Self {
        Self {
            client,
            prepared: DashMap::new(),
            pending: DashMap::new(),
            send_sessions: DashMap::new(),
            receive_sessions: Arc::new(DashMap::new()),
        }
    }

    // ============ 准备阶段 ============

    /// 准备发送：对预扫描的文件列表计算 BLAKE3 校验和、分配 fileId
    ///
    /// 接收 `scan_sources` 命令返回的 `EnumeratedFile` 列表。
    /// 前端可能已移除部分文件（用户在 UI 中取消选择）。
    /// 此方法不做目录遍历，只对每个文件计算 hash。
    /// 通过 `on_progress` Channel 实时上报字节级进度。
    pub async fn prepare(
        &self,
        entries: Vec<EnumeratedFile>,
        app: &AppHandle,
        on_progress: tauri::ipc::Channel<PrepareProgress>,
    ) -> AppResult<PreparedTransfer> {
        if entries.is_empty() {
            return Err(AppError::Transfer("文件列表为空".into()));
        }

        let total_files = entries.len() as u32;
        let total_bytes: u64 = entries.iter().map(|e| e.size).sum();
        let mut files = Vec::new();
        let mut completed_bytes: u64 = 0;

        for (file_id, entry) in entries.into_iter().enumerate() {
            let file_name: std::sync::Arc<str> = entry.name.clone().into();
            let base_bytes = completed_bytes;
            let completed_files = file_id as u32;
            let progress = on_progress.clone();

            let checksum = entry
                .source
                .compute_hash_with_progress(app, move |bytes_in_file| {
                    let _ = progress.send(PrepareProgress {
                        current_file: file_name.to_string(),
                        completed_files,
                        total_files,
                        bytes_hashed: base_bytes + bytes_in_file,
                        total_bytes,
                    });
                })
                .await?;

            completed_bytes += entry.size;
            files.push(PreparedFile {
                file_id: file_id as u32,
                name: entry.name,
                relative_path: entry.relative_path,
                source: entry.source,
                size: entry.size,
                checksum,
            });
        }

        // 最终完成事件
        let _ = on_progress.send(PrepareProgress {
            current_file: String::new(),
            completed_files: total_files,
            total_files,
            bytes_hashed: total_bytes,
            total_bytes,
        });

        let prepared = PreparedTransfer {
            prepared_id: generate_id(),
            files,
            total_size: total_bytes,
        };

        self.prepared
            .insert(prepared.prepared_id, prepared.clone());

        Ok(prepared)
    }

    // ============ 发送方：发送 Offer + 启动传输 ============

    /// 发送 Offer 到目标 peer，等待接收方回复
    ///
    /// 如果被接受，自动创建 SendSession 并缓存。
    pub async fn send_offer(
        &self,
        prepared_id: &Uuid,
        peer_id: &str,
        selected_file_ids: &[u32],
        app: AppHandle,
    ) -> AppResult<StartSendResult> {
        let prepared = self.take_prepared(prepared_id).ok_or_else(|| {
            AppError::Transfer(format!("PreparedTransfer not found: {prepared_id}"))
        })?;

        // 筛选选中的文件
        let selected_prepared: Vec<PreparedFile> = prepared
            .files
            .into_iter()
            .filter(|f| selected_file_ids.contains(&f.file_id))
            .collect();

        if selected_prepared.is_empty() {
            return Err(AppError::Transfer("未选择任何文件".into()));
        }

        let selected_files: Vec<FileInfo> = selected_prepared
            .iter()
            .map(|f| FileInfo {
                file_id: f.file_id,
                name: f.name.clone(),
                relative_path: f.relative_path.clone(),
                size: f.size,
                checksum: f.checksum.clone(),
            })
            .collect();

        let total_size: u64 = selected_files.iter().map(|f| f.size).sum();
        let session_id = generate_id();

        let target_peer: PeerId = peer_id
            .parse()
            .map_err(|_| AppError::Transfer(format!("无效的 PeerId: {peer_id}")))?;

        info!(
            "Sending transfer offer to {}: session={}, files={}",
            target_peer,
            session_id,
            selected_files.len()
        );

        let response = self
            .client
            .send_request(
                target_peer,
                AppRequest::Transfer(TransferRequest::Offer {
                    session_id,
                    files: selected_files,
                    total_size,
                }),
            )
            .await
            .map_err(|e| AppError::Transfer(format!("发送 Offer 失败: {e}")))?;

        match response {
            AppResponse::Transfer(TransferResponse::OfferResult {
                accepted,
                key,
                reason,
            }) => {
                if accepted {
                    if let Some(key) = key {
                        info!("Offer accepted for session {}, key received", session_id);

                        // 创建 SendSession
                        let send_session = Arc::new(SendSession::new(
                            session_id,
                            selected_prepared,
                            &key,
                            app,
                        ));
                        self.send_sessions.insert(session_id, send_session);
                    } else {
                        warn!(
                            "Offer accepted but no key received for session {}",
                            session_id
                        );
                    }
                } else {
                    info!("Offer rejected for session {}: {:?}", session_id, reason);
                }
                Ok(StartSendResult {
                    session_id,
                    accepted,
                    reason,
                })
            }
            other => Err(AppError::Transfer(format!("意外的响应类型: {other:?}"))),
        }
    }

    // ============ 发送方：响应 ChunkRequest ============

    /// 获取发送会话（事件循环调用）
    pub fn get_send_session(&self, session_id: &Uuid) -> Option<Arc<SendSession>> {
        self.send_sessions.get(session_id).map(|s| s.clone())
    }

    /// 移除发送会话
    pub fn remove_send_session(&self, session_id: &Uuid) {
        self.send_sessions.remove(session_id);
    }

    // ============ 接收方：缓存 + 响应 + 启动传输 ============

    /// 缓存入站 Offer（事件循环调用）
    pub fn cache_inbound_offer(
        &self,
        pending_id: u64,
        peer_id: PeerId,
        session_id: Uuid,
        files: Vec<FileInfo>,
        total_size: u64,
    ) {
        self.pending.insert(
            session_id,
            PendingOffer {
                pending_id,
                peer_id,
                session_id,
                files,
                total_size,
            },
        );
    }

    /// 接受传输并启动接收：生成密钥、回复 OfferResult、创建 ReceiveSession 并开始拉取
    pub async fn accept_and_start_receive(
        &self,
        session_id: &Uuid,
        save_path: String,
        app: AppHandle,
    ) -> AppResult<()> {
        let (_, offer) = self
            .pending
            .remove(session_id)
            .ok_or_else(|| AppError::Transfer(format!("pending offer not found: {session_id}")))?;

        let key = generate_key();

        info!("Accepting transfer offer: session={}", session_id);

        let response = AppResponse::Transfer(TransferResponse::OfferResult {
            accepted: true,
            key: Some(key),
            reason: None,
        });

        self.client
            .send_response(offer.pending_id, response)
            .await
            .map_err(|e| AppError::Transfer(format!("回复 OfferResult 失败: {e}")))?;

        // 创建 ReceiveSession 并启动后台拉取
        let sink = FileSink::Path {
            save_dir: std::path::PathBuf::from(save_path),
        };
        let receive_session = Arc::new(ReceiveSession::new(
            offer.session_id,
            offer.peer_id,
            offer.files,
            offer.total_size,
            sink,
            &key,
            self.client.clone(),
            app,
        ));

        self.receive_sessions
            .insert(offer.session_id, receive_session.clone());

        // 传输结束后自动从 receive_sessions 中清理
        let sessions_map = self.receive_sessions.clone();
        receive_session.start_pulling(move |session_id| {
            sessions_map.remove(session_id);
        });

        Ok(())
    }

    /// 拒绝传输：回复拒绝的 OfferResult
    pub async fn reject_and_respond(&self, session_id: &Uuid) -> AppResult<()> {
        let (_, offer) = self
            .pending
            .remove(session_id)
            .ok_or_else(|| AppError::Transfer(format!("pending offer not found: {session_id}")))?;

        info!("Rejecting transfer offer: session={}", session_id);

        let response = AppResponse::Transfer(TransferResponse::OfferResult {
            accepted: false,
            key: None,
            reason: Some("用户拒绝".into()),
        });

        self.client
            .send_response(offer.pending_id, response)
            .await
            .map_err(|e| AppError::Transfer(format!("回复拒绝 OfferResult 失败: {e}")))
    }

    // ============ 取消 ============

    /// 取消发送
    pub async fn cancel_send(&self, session_id: &Uuid) -> AppResult<()> {
        let (_, session) = self
            .send_sessions
            .remove(session_id)
            .ok_or_else(|| AppError::Transfer(format!("发送会话不存在: {session_id}")))?;

        session.cancel();
        info!("Send session cancelled: session={}", session_id);
        Ok(())
    }

    /// 取消接收
    pub async fn cancel_receive(&self, session_id: &Uuid) -> AppResult<()> {
        let (_, session) = self
            .receive_sessions
            .remove(session_id)
            .ok_or_else(|| AppError::Transfer(format!("接收会话不存在: {session_id}")))?;

        session.cancel();
        session.send_cancel().await;
        session.cleanup_part_files().await;
        info!("Receive session cancelled: session={}", session_id);
        Ok(())
    }

    /// 获取接收会话（事件循环调用）
    pub fn get_receive_session(&self, session_id: &Uuid) -> Option<Arc<ReceiveSession>> {
        self.receive_sessions.get(session_id).map(|s| s.clone())
    }

    /// 移除接收会话
    pub fn remove_receive_session(&self, session_id: &Uuid) {
        self.receive_sessions.remove(session_id);
    }

    // ============ 内部方法 ============

    fn take_prepared(&self, prepared_id: &Uuid) -> Option<PreparedTransfer> {
        self.prepared.remove(prepared_id).map(|(_, v)| v)
    }
}

/// 生成随机的 session/prepared ID（UUID v4）
pub fn generate_id() -> Uuid {
    Uuid::new_v4()
}
