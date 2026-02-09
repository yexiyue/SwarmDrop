mod identity;

pub use identity::*;

use swarm_p2p_core::{libp2p::identity::Keypair, NetClient, NodeConfig, NodeEvent};
use tauri::{ipc::Channel, AppHandle, Manager, State};
use tokio::sync::Mutex;
use tracing::error;

/// NetClient 状态类型
pub type NetClientState = Mutex<Option<NetClient>>;

#[tauri::command]
pub async fn start(
    app: AppHandle,
    keypair: State<'_, Keypair>,
    channel: Channel<NodeEvent>,
) -> crate::AppResult<()> {
    // 构建 agent 版本: swarmdrop/{version}; os={os}; arch={arch}; host={hostname}
    let agent_version = format!(
        "swarmdrop/{}; os={}; arch={}; host={}",
        env!("CARGO_PKG_VERSION"),
        tauri_plugin_os::type_(),
        tauri_plugin_os::arch(),
        tauri_plugin_os::hostname(),
    );

    let config = NodeConfig::new("/swarmdrop/1.0.0", agent_version)
        .with_mdns(true)
        .with_relay_client(true)
        .with_dcutr(true)
        .with_autonat(true);

    let (client, mut receiver) = swarm_p2p_core::start(&keypair, config)?;

    tokio::spawn(async move {
        while let Some(event) = receiver.recv().await {
            if let Err(e) = channel.send(event) {
                error!("Failed to send event: {}", e);
            }
        }
    });

    if let Some(state) = app.try_state::<NetClientState>() {
        *state.lock().await = Some(client);
    } else {
        app.manage(Mutex::new(Some(client)));
    }

    Ok(())
}

#[tauri::command]
pub async fn shutdown(app: AppHandle) -> crate::AppResult<()> {
    if let Some(state) = app.try_state::<NetClientState>() {
        // drop client 会关闭 command channel，通知 runtime 停止
        state.lock().await.take();
    }

    Ok(())
}
