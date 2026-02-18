//! 文件传输相关 Tauri 命令
//!
//! 薄层命令入口，所有业务逻辑委托给 [`transfer`](crate::transfer) 模块。

use crate::network::NetManagerState;
use crate::transfer::fs::{FileEntry, ListFilesResult};
use crate::transfer::offer::StartSendResult;
use serde::Serialize;
use tauri::State;

/// 准备好的文件信息（返回给前端）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferFileResult {
    pub file_id: u32,
    pub name: String,
    pub relative_path: String,
    pub size: u64,
    pub is_directory: bool,
}

/// prepare_send 的返回类型
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedTransferResult {
    pub prepared_id: String,
    pub files: Vec<TransferFileResult>,
    pub total_size: u64,
}

/// 递归列举路径下的所有文件
#[tauri::command]
pub async fn list_files(path: String) -> crate::AppResult<ListFilesResult> {
    crate::transfer::fs::list_files(path).await
}

/// 批量获取文件元信息
#[tauri::command]
pub async fn get_file_meta(paths: Vec<String>) -> crate::AppResult<Vec<FileEntry>> {
    crate::transfer::fs::get_file_meta(paths).await
}

/// 准备发送：扫描文件、计算 BLAKE3 校验和、分配 fileId
#[tauri::command]
pub async fn prepare_send(
    net: State<'_, NetManagerState>,
    file_paths: Vec<String>,
) -> crate::AppResult<PreparedTransferResult> {
    let transfer = {
        let guard = net.lock().await;
        let manager = guard.as_ref().ok_or_else(super::not_started)?;
        manager.transfer_arc()
    };

    let prepared = transfer.prepare(file_paths).await?;

    Ok(PreparedTransferResult {
        prepared_id: prepared.prepared_id,
        total_size: prepared.total_size,
        files: prepared
            .files
            .iter()
            .map(|f| TransferFileResult {
                file_id: f.file_id,
                name: f.name.clone(),
                relative_path: f.relative_path.clone(),
                size: f.size,
                is_directory: false,
            })
            .collect(),
    })
}

/// 开始发送：构造 Offer，通过 libp2p 发送到目标 peer，等待 OfferResult
#[tauri::command]
pub async fn start_send(
    net: State<'_, NetManagerState>,
    prepared_id: String,
    peer_id: String,
    selected_file_ids: Vec<u32>,
) -> crate::AppResult<StartSendResult> {
    let transfer = {
        let guard = net.lock().await;
        let manager = guard.as_ref().ok_or_else(super::not_started)?;
        manager.transfer_arc()
    };

    transfer
        .send_offer(&prepared_id, &peer_id, &selected_file_ids)
        .await
}

/// 确认接收：生成密钥，回复 OfferResult，启动后台拉取
#[tauri::command]
pub async fn accept_receive(
    app: tauri::AppHandle,
    net: State<'_, NetManagerState>,
    session_id: String,
    save_path: String,
) -> crate::AppResult<()> {
    let transfer = {
        let guard = net.lock().await;
        let manager = guard.as_ref().ok_or_else(super::not_started)?;
        manager.transfer_arc()
    };

    transfer
        .accept_and_start_receive(&session_id, save_path, app)
        .await
}

/// 拒绝接收：回复拒绝的 OfferResult
#[tauri::command]
pub async fn reject_receive(
    net: State<'_, NetManagerState>,
    session_id: String,
) -> crate::AppResult<()> {
    let transfer = {
        let guard = net.lock().await;
        let manager = guard.as_ref().ok_or_else(super::not_started)?;
        manager.transfer_arc()
    };

    transfer.reject_and_respond(&session_id).await
}

/// 取消发送
#[tauri::command]
pub async fn cancel_send(
    net: State<'_, NetManagerState>,
    session_id: String,
) -> crate::AppResult<()> {
    let transfer = {
        let guard = net.lock().await;
        let manager = guard.as_ref().ok_or_else(super::not_started)?;
        manager.transfer_arc()
    };

    transfer.cancel_send(&session_id).await
}

/// 取消接收
#[tauri::command]
pub async fn cancel_receive(
    net: State<'_, NetManagerState>,
    session_id: String,
) -> crate::AppResult<()> {
    let transfer = {
        let guard = net.lock().await;
        let manager = guard.as_ref().ok_or_else(super::not_started)?;
        manager.transfer_arc()
    };

    transfer.cancel_receive(&session_id).await
}
