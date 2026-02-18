//! Offer 管理器
//!
//! 管理发送方的 `PreparedTransfer` 缓存和接收方的 `PendingOffer` 缓存，
//! 并封装 Offer 协议的完整业务逻辑（发送、接受、拒绝）。
//! 遵循与 [`PairingManager`](crate::pairing::manager) 相同的模式：
//! 事件循环写入缓存 → 前端操作后通过 Tauri 命令消费缓存。

use std::path::PathBuf;

use blake3::Hasher;
use dashmap::DashMap;
use path_slash::PathExt as _;
use serde::Serialize;
use swarm_p2p_core::libp2p::PeerId;
use tracing::{info, warn};
use walkdir::WalkDir;

use crate::protocol::{
    AppNetClient, AppRequest, AppResponse, FileInfo, TransferRequest, TransferResponse,
};
use crate::transfer::crypto::generate_key;
use crate::{AppError, AppResult};

/// 发送方准备好的传输信息
#[derive(Debug, Clone)]
pub struct PreparedTransfer {
    /// 唯一标识符
    pub prepared_id: String,
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
    /// 绝对路径（发送时读取文件用）
    pub absolute_path: String,
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
    pub session_id: String,
    /// 文件列表
    pub files: Vec<FileInfo>,
    /// 总大小
    pub total_size: u64,
}

/// `send_offer` 的返回类型
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSendResult {
    pub session_id: String,
    pub accepted: bool,
    pub reason: Option<String>,
}

/// Offer 管理器
pub struct OfferManager {
    /// libp2p 网络客户端
    client: AppNetClient,
    /// 发送方：prepare_send 的缓存（key = prepared_id）
    prepared: DashMap<String, PreparedTransfer>,
    /// 接收方：入站 Offer 的缓存（key = session_id）
    pending: DashMap<String, PendingOffer>,
}

impl OfferManager {
    pub fn new(client: AppNetClient) -> Self {
        Self {
            client,
            prepared: DashMap::new(),
            pending: DashMap::new(),
        }
    }

    // ============ 准备阶段 ============

    /// 准备发送：扫描文件、计算 BLAKE3 校验和、分配 fileId
    ///
    /// 在 `tokio::task::spawn_blocking` 中调用，避免阻塞异步运行时。
    pub async fn prepare(&self, file_paths: Vec<String>) -> AppResult<PreparedTransfer> {
        let prepared = tokio::task::spawn_blocking(move || prepare_sync(file_paths)).await??;

        self.prepared
            .insert(prepared.prepared_id.clone(), prepared.clone());

        Ok(prepared)
    }

    // ============ 发送方：发送 Offer ============

    /// 发送 Offer 到目标 peer，等待接收方回复
    ///
    /// 消费 `PreparedTransfer`，筛选选中的文件，构造 Offer 请求并发送。
    /// 返回接收方的接受/拒绝结果。
    pub async fn send_offer(
        &self,
        prepared_id: &str,
        peer_id: &str,
        selected_file_ids: &[u32],
    ) -> AppResult<StartSendResult> {
        let prepared = self
            .take_prepared(prepared_id)
            .ok_or_else(|| {
                AppError::Transfer(format!("PreparedTransfer not found: {prepared_id}"))
            })?;

        // 筛选选中的文件
        let selected_files: Vec<FileInfo> = prepared
            .files
            .iter()
            .filter(|f| selected_file_ids.contains(&f.file_id))
            .map(|f| FileInfo {
                file_id: f.file_id,
                name: f.name.clone(),
                relative_path: f.relative_path.clone(),
                size: f.size,
                checksum: f.checksum.clone(),
            })
            .collect();

        if selected_files.is_empty() {
            return Err(AppError::Transfer("未选择任何文件".into()));
        }

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
                    session_id: session_id.clone(),
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
                    if key.is_some() {
                        info!("Offer accepted for session {}, key received", session_id);
                        // 密钥会在后续分块传输中使用
                    } else {
                        warn!(
                            "Offer accepted but no key received for session {}",
                            session_id
                        );
                    }
                } else {
                    info!(
                        "Offer rejected for session {}: {:?}",
                        session_id, reason
                    );
                }
                Ok(StartSendResult {
                    session_id,
                    accepted,
                    reason,
                })
            }
            other => Err(AppError::Transfer(format!(
                "意外的响应类型: {other:?}"
            ))),
        }
    }

    // ============ 接收方：缓存 + 响应 ============

    /// 缓存入站 Offer（事件循环调用）
    pub fn cache_inbound_offer(
        &self,
        pending_id: u64,
        peer_id: PeerId,
        session_id: String,
        files: Vec<FileInfo>,
        total_size: u64,
    ) {
        self.pending.insert(
            session_id.clone(),
            PendingOffer {
                pending_id,
                peer_id,
                session_id,
                files,
                total_size,
            },
        );
    }

    /// 接受传输：生成密钥，回复接受的 OfferResult
    pub async fn accept_and_respond(&self, session_id: &str) -> AppResult<()> {
        let (pending_id, key) = self.accept(session_id)?;

        info!("Accepting transfer offer: session={}", session_id);

        let response = AppResponse::Transfer(TransferResponse::OfferResult {
            accepted: true,
            key: Some(key),
            reason: None,
        });

        self.client
            .send_response(pending_id, response)
            .await
            .map_err(|e| AppError::Transfer(format!("回复 OfferResult 失败: {e}")))
    }

    /// 拒绝传输：回复拒绝的 OfferResult
    pub async fn reject_and_respond(&self, session_id: &str) -> AppResult<()> {
        let pending_id = self.reject(session_id)?;

        info!("Rejecting transfer offer: session={}", session_id);

        let response = AppResponse::Transfer(TransferResponse::OfferResult {
            accepted: false,
            key: None,
            reason: Some("用户拒绝".into()),
        });

        self.client
            .send_response(pending_id, response)
            .await
            .map_err(|e| AppError::Transfer(format!("回复拒绝 OfferResult 失败: {e}")))
    }

    // ============ 内部方法 ============

    /// 消费一个 PreparedTransfer（一次性消费）
    fn take_prepared(&self, prepared_id: &str) -> Option<PreparedTransfer> {
        self.prepared.remove(prepared_id).map(|(_, v)| v)
    }

    /// 接受传输：取出 PendingOffer，生成密钥
    fn accept(&self, session_id: &str) -> AppResult<(u64, [u8; 32])> {
        let (_, offer) = self
            .pending
            .remove(session_id)
            .ok_or_else(|| AppError::Transfer(format!("pending offer not found: {session_id}")))?;

        let key = generate_key();
        Ok((offer.pending_id, key))
    }

    /// 拒绝传输：取出 PendingOffer
    fn reject(&self, session_id: &str) -> AppResult<u64> {
        let (_, offer) = self
            .pending
            .remove(session_id)
            .ok_or_else(|| AppError::Transfer(format!("pending offer not found: {session_id}")))?;

        Ok(offer.pending_id)
    }
}

/// 生成随机的 session/prepared ID（UUID v4）
pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 同步准备文件（在 blocking task 中执行）
fn prepare_sync(file_paths: Vec<String>) -> AppResult<PreparedTransfer> {
    if file_paths.is_empty() {
        return Err(AppError::Transfer("文件列表为空".into()));
    }

    let mut files = Vec::new();
    let mut file_id: u32 = 0;
    let mut total_size: u64 = 0;

    for path_str in file_paths {
        let path = PathBuf::from(&path_str);
        let meta = std::fs::metadata(&path)?;

        if meta.is_file() {
            // 单文件：relative_path = 文件名
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            let checksum = compute_checksum(&path)?;
            let size = meta.len();

            files.push(PreparedFile {
                file_id,
                name: name.clone(),
                relative_path: name,
                absolute_path: path_str,
                size,
                checksum,
            });
            total_size += size;
            file_id += 1;
        } else if meta.is_dir() {
            // 目录：递归遍历，relative_path = 目录名/子路径
            let dir_name = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();

            for entry in WalkDir::new(&path)
                .follow_links(true)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if entry.file_type().is_dir() {
                    continue;
                }

                let entry_path = entry.path();
                let name = entry_path
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default();

                // 计算相对路径：dir_name + 从目录根开始的子路径
                let sub_path = pathdiff::diff_paths(entry_path, &path)
                    .unwrap_or_else(|| entry_path.to_path_buf());
                let relative_path = format!(
                    "{dir_name}/{}",
                    sub_path.to_slash_lossy()
                );

                let checksum = compute_checksum(entry_path)?;
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

                files.push(PreparedFile {
                    file_id,
                    name,
                    relative_path,
                    absolute_path: entry_path.to_string_lossy().into_owned(),
                    size,
                    checksum,
                });
                total_size += size;
                file_id += 1;
            }
        }
    }

    if files.is_empty() {
        return Err(AppError::Transfer("未找到有效文件".into()));
    }

    Ok(PreparedTransfer {
        prepared_id: generate_id(),
        files,
        total_size,
    })
}

/// 计算文件的 BLAKE3 校验和（hex 编码）
fn compute_checksum(path: &std::path::Path) -> AppResult<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Hasher::new();
    hasher.update_reader(&mut file)?;
    Ok(hasher.finalize().to_hex().to_string())
}
