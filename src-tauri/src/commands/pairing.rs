use super::NetManagerState;
use crate::pairing::code::{PairingCodeInfo, ShareCodeRecord};
use crate::protocol::{PairingMethod, PairingResponse};
use crate::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use swarm_p2p_core::libp2p::{Multiaddr, PeerId};
use tauri::State;

/// 查询设备信息的返回类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub peer_id: PeerId,
    pub code_record: ShareCodeRecord,
}

/// 获取节点未启动的错误
fn not_started() -> AppError {
    AppError::Network("节点未启动".into())
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
#[tauri::command]
pub async fn request_pairing(
    net: State<'_, NetManagerState>,
    peer_id: PeerId,
    method: PairingMethod,
    addrs: Option<Vec<Multiaddr>>,
) -> AppResult<PairingResponse> {
    let guard = net.lock().await;
    let manager = guard.as_ref().ok_or_else(not_started)?;
    manager
        .pairing()
        .request_pairing(peer_id, method, addrs)
        .await
}

/// 处理收到的配对请求（接受/拒绝）
#[tauri::command]
pub async fn respond_pairing_request(
    net: State<'_, NetManagerState>,
    pending_id: u64,
    method: PairingMethod,
    response: PairingResponse,
) -> AppResult<()> {
    let guard = net.lock().await;
    let manager = guard.as_ref().ok_or_else(not_started)?;
    manager
        .pairing()
        .handle_pairing_request(pending_id, &method, response)
        .await
}
