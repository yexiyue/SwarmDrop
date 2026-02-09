mod identity;
mod pairing;

pub use identity::*;
pub use pairing::*;

use crate::pairing::manager::PairingManager;
use crate::protocol::{AppNetClient, AppRequest, AppResponse};
use swarm_p2p_core::{
    libp2p::{identity::Keypair, multiaddr::Protocol, Multiaddr, PeerId},
    NodeConfig, NodeEvent,
};
use tauri::{ipc::Channel, AppHandle, Manager, State};
use tokio::sync::Mutex;
use tracing::{error, info, warn};

/// SwarmDrop 引导+中继节点
///
/// 使用 /ip4/ 格式，所有平台通用（Android 无 DNS transport）。
/// 部署到正式 VPS 后替换为公网 IP。
const BOOTSTRAP_NODES: &[&str] = &[
    // ==== SwarmDrop 自有引导+中继节点 ====
    "/ip4/47.115.172.218/tcp/4001/p2p/12D3KooWCq8xgrSap7VZZHpW7EYXw8zFmNEgru9D7cGHGW3bMASX",
    "/ip4/47.115.172.218/udp/4001/quic-v1/p2p/12D3KooWCq8xgrSap7VZZHpW7EYXw8zFmNEgru9D7cGHGW3bMASX",
];

/// 解析引导节点地址列表为 (PeerId, Multiaddr) 对
fn parse_bootstrap_peers() -> Vec<(PeerId, Multiaddr)> {
    BOOTSTRAP_NODES
        .iter()
        .filter_map(|s| {
            let addr: Multiaddr = s.parse().ok()?;
            // 从 multiaddr 末尾的 /p2p/<peer_id> 提取 PeerId
            let peer_id = addr.iter().find_map(|p| match p {
                Protocol::P2p(id) => Some(id),
                _ => None,
            })?;
            Some((peer_id, addr))
        })
        .collect()
}

/// 网络管理器，统一管理 NetClient 和各子功能 Manager
pub struct NetManager {
    pub client: AppNetClient,
    pub peer_id: PeerId,
    pub pairing: PairingManager,
}

impl NetManager {
    pub fn new(client: AppNetClient, peer_id: PeerId) -> Self {
        let pairing = PairingManager::new(client.clone(), peer_id);
        Self {
            client,
            peer_id,
            pairing,
        }
    }

    pub fn pairing(&self) -> &PairingManager {
        &self.pairing
    }
}

pub type NetManagerState = Mutex<Option<NetManager>>;

#[tauri::command]
pub async fn start(
    app: AppHandle,
    keypair: State<'_, Keypair>,
    channel: Channel<NodeEvent<AppRequest>>,
) -> crate::AppResult<()> {
    let agent_version = crate::device::OsInfo::new().to_agent_version();

    let bootstrap_peers = parse_bootstrap_peers();
    info!("Parsed {} bootstrap peers", bootstrap_peers.len());

    let config = NodeConfig::new("/swarmdrop/1.0.0", agent_version)
        .with_mdns(true)
        .with_relay_client(true)
        .with_dcutr(true)
        .with_autonat(true)
        .with_bootstrap_peers(bootstrap_peers);

    let (client, mut receiver) =
        swarm_p2p_core::start::<AppRequest, AppResponse>((*keypair).clone(), config)?;

    // 异步执行 DHT bootstrap（填充路由表）
    let bootstrap_client = client.clone();
    tokio::spawn(async move {
        match bootstrap_client.bootstrap().await {
            Ok(result) => info!("DHT bootstrap completed: {:?}", result),
            Err(e) => warn!("DHT bootstrap failed: {}", e),
        }
    });

    tokio::spawn(async move {
        while let Some(event) = receiver.recv().await {
            if let Err(e) = channel.send(event) {
                error!("Failed to send event: {}", e);
            }
        }
    });

    let peer_id = PeerId::from_public_key(&keypair.public());
    let net_manager = NetManager::new(client, peer_id);

    // 宣布上线，让其他节点可以发现自己
    if let Err(e) = net_manager.pairing().announce_online().await {
        warn!("Failed to announce online: {}", e);
    }

    if let Some(state) = app.try_state::<NetManagerState>() {
        *state.lock().await = Some(net_manager);
    } else {
        app.manage(Mutex::new(Some(net_manager)));
    }

    Ok(())
}

#[tauri::command]
pub async fn shutdown(app: AppHandle) -> crate::AppResult<()> {
    if let Some(state) = app.try_state::<NetManagerState>() {
        let mut guard = state.lock().await;
        if let Some(manager) = guard.as_ref() {
            // 先宣布离线，再释放资源
            if let Err(e) = manager.pairing().announce_offline().await {
                warn!("Failed to announce offline: {}", e);
            }
        }
        // drop NetManager，释放所有 client clone
        guard.take();
    }

    Ok(())
}
