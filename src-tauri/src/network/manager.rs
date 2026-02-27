use std::collections::HashSet;
use std::sync::{Arc, RwLock};

use dashmap::DashMap;
use swarm_p2p_core::libp2p::{Multiaddr, PeerId};
use tokio::sync::Mutex;

use super::{NatStatus, NetworkStatus, NodeStatus};
use crate::device::{DeviceManager, PairedDeviceInfo};
use crate::pairing::manager::PairingManager;
use crate::protocol::AppNetClient;
use crate::transfer::offer::TransferManager;

/// 网络管理器
///
/// 统一管理 [`AppNetClient`]、[`DeviceManager`] 和 [`PairingManager`]，
/// 对 [`commands`](crate::commands) 层提供访问接口。
pub struct NetManager {
    client: AppNetClient,
    peer_id: PeerId,
    pairing: Arc<PairingManager>,
    devices: Arc<DeviceManager>,
    transfer: Arc<TransferManager>,
    // 网络状态（Arc<RwLock> 供事件循环并发更新）
    listen_addrs: Arc<RwLock<Vec<Multiaddr>>>,
    nat_status: Arc<RwLock<NatStatus>>,
    public_addr: Arc<RwLock<Option<Multiaddr>>>,
    relay_ready: Arc<RwLock<bool>>,
    bootstrap_connected: Arc<RwLock<bool>>,
    /// 引导节点 PeerId 集合，用于判断连接是否为引导节点
    bootstrap_peer_ids: Arc<HashSet<PeerId>>,
}

impl NetManager {
    pub fn new(
        client: AppNetClient,
        peer_id: PeerId,
        paired_devices: Vec<PairedDeviceInfo>,
        bootstrap_peer_ids: HashSet<PeerId>,
    ) -> Self {
        // 创建共享的已配对设备 Map：PairingManager 读写，DeviceManager 只读
        let paired_map: Arc<DashMap<_, _>> = Arc::new(
            paired_devices
                .into_iter()
                .map(|info| (info.peer_id, info))
                .collect(),
        );

        let pairing = Arc::new(PairingManager::new(
            client.clone(),
            peer_id,
            paired_map.clone(),
        ));
        let devices = Arc::new(DeviceManager::new(paired_map));
        let transfer = Arc::new(TransferManager::new(client.clone()));
        Self {
            client,
            peer_id,
            pairing,
            devices,
            transfer,
            listen_addrs: Arc::new(RwLock::new(Vec::new())),
            nat_status: Arc::new(RwLock::new(NatStatus::Unknown)),
            public_addr: Arc::new(RwLock::new(None)),
            relay_ready: Arc::new(RwLock::new(false)),
            bootstrap_connected: Arc::new(RwLock::new(false)),
            bootstrap_peer_ids: Arc::new(bootstrap_peer_ids),
        }
    }

    pub fn pairing(&self) -> &PairingManager {
        &self.pairing
    }

    pub fn devices(&self) -> &DeviceManager {
        &self.devices
    }

    pub fn transfer(&self) -> &TransferManager {
        &self.transfer
    }

    pub fn transfer_arc(&self) -> Arc<TransferManager> {
        self.transfer.clone()
    }

    pub fn client(&self) -> &AppNetClient {
        &self.client
    }

    /// 获取当前网络状态快照
    pub fn get_network_status(&self) -> NetworkStatus {
        self.shared_refs().build_network_status()
    }

    /// 获取事件循环需要的共享引用
    pub(crate) fn shared_refs(&self) -> SharedNetRefs {
        SharedNetRefs {
            peer_id: self.peer_id,
            client: self.client.clone(),
            devices: self.devices.clone(),
            pairing: self.pairing.clone(),
            transfer: self.transfer.clone(),
            listen_addrs: self.listen_addrs.clone(),
            nat_status: self.nat_status.clone(),
            public_addr: self.public_addr.clone(),
            relay_ready: self.relay_ready.clone(),
            bootstrap_connected: self.bootstrap_connected.clone(),
            bootstrap_peer_ids: self.bootstrap_peer_ids.clone(),
        }
    }
}

/// 事件循环使用的共享引用
///
/// 持有与 [`NetManager`] 相同的 Arc 引用，
/// 供 [`spawn_event_loop`](super::spawn_event_loop) 在独立 tokio task 中更新网络状态。
pub(crate) struct SharedNetRefs {
    pub peer_id: PeerId,
    pub client: AppNetClient,
    pub devices: Arc<DeviceManager>,
    pub pairing: Arc<PairingManager>,
    pub transfer: Arc<TransferManager>,
    pub listen_addrs: Arc<RwLock<Vec<Multiaddr>>>,
    pub nat_status: Arc<RwLock<NatStatus>>,
    pub public_addr: Arc<RwLock<Option<Multiaddr>>>,
    pub relay_ready: Arc<RwLock<bool>>,
    pub bootstrap_connected: Arc<RwLock<bool>>,
    pub bootstrap_peer_ids: Arc<HashSet<PeerId>>,
}

impl SharedNetRefs {
    /// 构建当前网络状态快照
    pub fn build_network_status(&self) -> NetworkStatus {
        NetworkStatus {
            status: NodeStatus::Running,
            peer_id: Some(self.peer_id),
            listen_addrs: read_or(&self.listen_addrs, Vec::new()),
            nat_status: read_or(&self.nat_status, NatStatus::Unknown),
            public_addr: self.public_addr.read().ok().and_then(|g| g.clone()),
            connected_peers: self.devices.connected_count(),
            discovered_peers: self.devices.discovered_count(),
            relay_ready: read_or(&self.relay_ready, false),
            bootstrap_connected: read_or(&self.bootstrap_connected, false),
        }
    }
}

/// 读取 RwLock，中毒时返回默认值
fn read_or<T: Clone>(lock: &RwLock<T>, default: T) -> T {
    lock.read().map(|g| g.clone()).unwrap_or(default)
}

/// Tauri 状态中的网络管理器容器
pub type NetManagerState = Mutex<Option<NetManager>>;
