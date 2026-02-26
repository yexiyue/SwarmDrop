//! 文件传输相关 Tauri 命令
//!
//! 薄层命令入口，所有业务逻辑委托给 [`transfer`](crate::transfer) 模块。

use crate::file_source::{EnumeratedFile, FileSource};
use crate::network::NetManagerState;
use crate::transfer::offer::StartSendResult;
use serde::Serialize;
use tauri::State;
use uuid::Uuid;

// ============ scan_sources ============

/// scan_sources 返回的单个来源扫描结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedSourceResult {
    /// 是否为目录
    pub is_directory: bool,
    /// 包含的文件列表（每个文件带有 source 用于后续传给 prepare_send）
    pub files: Vec<EnumeratedFile>,
    /// 此来源的总大小
    pub total_size: u64,
}

/// 扫描文件来源：遍历目录、收集元数据，不计算 hash
///
/// 用于用户选择文件/文件夹后在 UI 上展示文件树。
/// 每个 FileSource 返回一个 ScannedSourceResult，包含扁平化的文件列表。
#[tauri::command]
pub async fn scan_sources(
    app: tauri::AppHandle,
    sources: Vec<FileSource>,
) -> crate::AppResult<Vec<ScannedSourceResult>> {
    let mut results = Vec::new();

    for source in sources {
        let meta = source.metadata(&app).await?;

        if meta.is_dir {
            let entries = source.enumerate_dir(&meta.name, &app).await?;
            let total_size: u64 = entries.iter().map(|e| e.size).sum();
            results.push(ScannedSourceResult {
                is_directory: true,
                files: entries,
                total_size,
            });
        } else {
            results.push(ScannedSourceResult {
                is_directory: false,
                total_size: meta.size,
                files: vec![EnumeratedFile {
                    name: meta.name.clone(),
                    relative_path: meta.name,
                    source,
                    size: meta.size,
                }],
            });
        }
    }

    Ok(results)
}

// ============ prepare_send ============

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
    pub prepared_id: Uuid,
    pub files: Vec<TransferFileResult>,
    pub total_size: u64,
}

/// 准备发送：对预扫描的文件列表计算 BLAKE3 校验和、分配 fileId
///
/// 接收 `scan_sources` 返回的 `EnumeratedFile` 列表（前端可能已过滤掉用户移除的文件）。
/// 不再做目录遍历，只计算 hash。
#[tauri::command]
pub async fn prepare_send(
    app: tauri::AppHandle,
    net: State<'_, NetManagerState>,
    files: Vec<EnumeratedFile>,
) -> crate::AppResult<PreparedTransferResult> {
    let transfer = {
        let guard = net.lock().await;
        let manager = guard.as_ref().ok_or_else(super::not_started)?;
        manager.transfer_arc()
    };

    let prepared = transfer.prepare(files, &app).await?;

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
    app: tauri::AppHandle,
    net: State<'_, NetManagerState>,
    prepared_id: Uuid,
    peer_id: String,
    selected_file_ids: Vec<u32>,
) -> crate::AppResult<StartSendResult> {
    let transfer = {
        let guard = net.lock().await;
        let manager = guard.as_ref().ok_or_else(super::not_started)?;
        manager.transfer_arc()
    };

    transfer
        .send_offer(&prepared_id, &peer_id, &selected_file_ids, app)
        .await
}

/// 确认接收：生成密钥，回复 OfferResult，启动后台拉取
#[tauri::command]
pub async fn accept_receive(
    app: tauri::AppHandle,
    net: State<'_, NetManagerState>,
    session_id: Uuid,
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
    session_id: Uuid,
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
    session_id: Uuid,
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
    session_id: Uuid,
) -> crate::AppResult<()> {
    let transfer = {
        let guard = net.lock().await;
        let manager = guard.as_ref().ok_or_else(super::not_started)?;
        manager.transfer_arc()
    };

    transfer.cancel_receive(&session_id).await
}
