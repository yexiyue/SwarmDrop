use crate::events;
use crate::network::NetManagerState;
use crate::pairing::code::{PairingCodeInfo, ShareCodeRecord};
use crate::protocol::{PairingMethod, PairingResponse};
use crate::AppResult;
use serde::{Deserialize, Serialize};
use swarm_p2p_core::libp2p::{Multiaddr, PeerId};
use tauri::{AppHandle, Emitter, State};

use super::not_started;

/// 查询设备信息的返回类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub peer_id: PeerId,
    pub code_record: ShareCodeRecord,
}

/// 生成配对码
#[tauri::command]
pub async fn generate_pairing_code(
    net: State<'_, NetManagerState>,
    expires_in_secs: Option<u64>,
) -> AppResult<PairingCodeInfo> {
    let guard = net.lock().await;
    let manager = guard.as_ref().ok_or_else(not_started)?;
    manager
        .pairing()
        .generate_code(expires_in_secs.unwrap_or(300))
        .await
}

/// 通过配对码查询对端设备信息
#[tauri::command]
pub async fn get_device_info(
    net: State<'_, NetManagerState>,
    code: String,
) -> AppResult<DeviceInfo> {
    let guard = net.lock().await;
    let manager = guard.as_ref().ok_or_else(not_started)?;
    let (peer_id, record) = manager.pairing().get_device_info(&code).await?;

    Ok(DeviceInfo {
        peer_id,
        code_record: record,
    })
}

/// 向对端发起配对请求
///
/// 配对成功后自动添加到已配对设备，并 emit `paired-device-added` 事件通知前端。
#[tauri::command]
pub async fn request_pairing(
    app: AppHandle,
    net: State<'_, NetManagerState>,
    peer_id: PeerId,
    method: PairingMethod,
    addrs: Option<Vec<Multiaddr>>,
) -> AppResult<PairingResponse> {
    let guard = net.lock().await;
    let manager = guard.as_ref().ok_or_else(not_started)?;
    let (response, paired_info) = manager
        .pairing()
        .request_pairing(peer_id, method, addrs)
        .await?;

    if let Some(info) = paired_info {
        let _ = app.emit(events::PAIRED_DEVICE_ADDED, &info);
    }

    Ok(response)
}

/// 取消与指定设备的配对（同步更新运行时状态）
#[tauri::command]
pub async fn remove_paired_device(
    net: State<'_, NetManagerState>,
    peer_id: PeerId,
) -> AppResult<()> {
    let guard = net.lock().await;
    // 节点未运行时静默成功（前端仍会更新 Stronghold）
    if let Some(manager) = guard.as_ref() {
        manager.pairing().remove_paired_device(&peer_id);
    }
    Ok(())
}

/// 处理收到的配对请求（接受/拒绝）
///
/// 接受配对后自动添加到已配对设备，并 emit `paired-device-added` 事件通知前端。
#[tauri::command]
pub async fn respond_pairing_request(
    app: AppHandle,
    net: State<'_, NetManagerState>,
    pending_id: u64,
    method: PairingMethod,
    response: PairingResponse,
) -> AppResult<()> {
    let guard = net.lock().await;
    let manager = guard.as_ref().ok_or_else(not_started)?;
    let paired_info = manager
        .pairing()
        .handle_pairing_request(pending_id, &method, response)
        .await?;

    if let Some(info) = paired_info {
        let _ = app.emit(events::PAIRED_DEVICE_ADDED, &info);
    }

    Ok(())
}
