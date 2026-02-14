//! Tauri IPC 命令入口
//!
//! 薄层命令入口，仅负责 Tauri 状态读取和参数解析，
//! 所有业务逻辑委托给 [`network`](crate::network)、
//! [`device`](crate::device) 和 [`pairing`](crate::pairing) 模块。

mod identity;
mod pairing;
pub mod upgrade;

// glob re-export：Tauri 的 #[tauri::command] 宏会生成 __cmd__* 隐藏符号，
// generate_handler! 需要通过模块路径访问这些符号，显式导出无法覆盖。
pub use identity::*;
pub use pairing::*;

use crate::device::{DeviceFilter, DeviceListResult, PairedDeviceInfo};
use crate::network::{NetManager, NetManagerState, NetworkStatus};
use crate::protocol::{AppRequest, AppResponse};
use crate::AppError;
use swarm_p2p_core::libp2p::{identity::Keypair, PeerId};
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;
use tracing::{info, warn};

/// 节点未启动时的统一错误
pub(super) fn not_started() -> AppError {
    AppError::NodeNotStarted
}

#[tauri::command]
pub async fn start(
    app: AppHandle,
    keypair: State<'_, Keypair>,
    paired_devices: Vec<PairedDeviceInfo>,
) -> crate::AppResult<()> {
    let agent_version = crate::device::OsInfo::default().to_agent_version();
    let config = crate::network::config::create_node_config(agent_version);

    let (client, receiver) =
        swarm_p2p_core::start::<AppRequest, AppResponse>((*keypair).clone(), config)
            .map_err(|e| AppError::Network(e.to_string()))?;

    // 异步执行 DHT bootstrap（填充路由表）
    let bootstrap_client = client.clone();
    tokio::spawn(async move {
        match bootstrap_client.bootstrap().await {
            Ok(result) => info!("DHT bootstrap completed: {:?}", result),
            Err(e) => warn!("DHT bootstrap failed: {}", e),
        }
    });

    let peer_id = PeerId::from_public_key(&keypair.public());
    let net_manager = NetManager::new(client, peer_id, paired_devices);

    // 宣布上线
    if let Err(e) = net_manager.pairing().announce_online().await {
        warn!("Failed to announce online: {}", e);
    }

    // 获取事件循环需要的共享引用（在存入 state 之前）
    let shared = net_manager.shared_refs();

    // 存入 Tauri state
    if let Some(state) = app.try_state::<NetManagerState>() {
        *state.lock().await = Some(net_manager);
    } else {
        app.manage(Mutex::new(Some(net_manager)));
    }

    // 启动事件循环
    crate::network::spawn_event_loop(receiver, app, shared);

    Ok(())
}

#[tauri::command]
pub async fn shutdown(app: AppHandle) -> crate::AppResult<()> {
    if let Some(state) = app.try_state::<NetManagerState>() {
        let mut guard = state.lock().await;
        if let Some(manager) = guard.as_ref() {
            if let Err(e) = manager.pairing().announce_offline().await {
                warn!("Failed to announce offline: {}", e);
            }
        }
        guard.take();
    }

    Ok(())
}

#[tauri::command]
pub async fn list_devices(
    net: State<'_, NetManagerState>,
    filter: Option<DeviceFilter>,
) -> crate::AppResult<DeviceListResult> {
    let guard = net.lock().await;
    let manager = guard.as_ref().ok_or_else(not_started)?;

    let devices = manager.devices().get_devices(filter.unwrap_or_default());
    let total = devices.len();
    Ok(DeviceListResult { devices, total })
}

#[tauri::command]
pub async fn get_network_status(
    net: State<'_, NetManagerState>,
) -> crate::AppResult<NetworkStatus> {
    let guard = net.lock().await;
    match guard.as_ref() {
        Some(manager) => Ok(manager.get_network_status()),
        None => Ok(NetworkStatus::default()),
    }
}
