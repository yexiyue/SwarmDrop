//! 网络模块
//!
//! 管理 P2P 节点的启动/关闭、事件循环和运行时网络状态。
//! [`NetManager`] 整合 [`NetClient`](swarm_p2p_core::NetClient)、
//! [`DeviceManager`](crate::device::DeviceManager) 和
//! [`PairingManager`](crate::pairing::manager::PairingManager)，
//! 对外提供统一的网络管理接口。

pub mod config;
mod event_loop;
mod manager;

pub use event_loop::spawn_event_loop;
pub use manager::{NetManager, NetManagerState};
pub use swarm_p2p_core::event::NatStatus;

use serde::Serialize;
use swarm_p2p_core::libp2p::{Multiaddr, PeerId};

/// 节点运行状态
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NodeStatus {
    Running,
    #[default]
    Stopped,
}

/// 网络状态快照
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatus {
    pub status: NodeStatus,
    pub peer_id: Option<PeerId>,
    pub listen_addrs: Vec<Multiaddr>,
    pub nat_status: NatStatus,
    pub public_addr: Option<Multiaddr>,
    pub connected_peers: usize,
    pub discovered_peers: usize,
    /// Relay 中继是否就绪（已获得 reservation）
    pub relay_ready: bool,
    /// 是否至少有一个引导节点已连接
    pub bootstrap_connected: bool,
}
