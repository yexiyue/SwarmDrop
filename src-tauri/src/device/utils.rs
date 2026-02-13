use swarm_p2p_core::libp2p::{multiaddr::Protocol, Multiaddr};

use super::ConnectionType;

/// 基于 Multiaddr 分析推断连接类型
///
/// 优先级: Lan > Dcutr > Relay
///
/// 规则:
/// 1. 地址含 `/p2p-circuit/` → Relay
/// 2. 地址 IP 为私有地址 → Lan
/// 3. 其余（公网 IP 直连） → Dcutr
pub fn infer_connection_type(addrs: &[Multiaddr]) -> Option<ConnectionType> {
    if addrs.is_empty() {
        return None;
    }

    let mut has_lan = false;
    let mut has_dcutr = false;
    let mut has_relay = false;

    for addr in addrs {
        if has_p2p_circuit(addr) {
            has_relay = true;
        } else if has_private_ip(addr) {
            has_lan = true;
        } else if has_public_ip(addr) {
            has_dcutr = true;
        }
    }

    if has_lan {
        Some(ConnectionType::Lan)
    } else if has_dcutr {
        Some(ConnectionType::Dcutr)
    } else if has_relay {
        Some(ConnectionType::Relay)
    } else {
        None
    }
}

fn has_p2p_circuit(addr: &Multiaddr) -> bool {
    addr.iter().any(|p| matches!(p, Protocol::P2pCircuit))
}

fn has_private_ip(addr: &Multiaddr) -> bool {
    addr.iter().any(|p| {
        matches!(p, Protocol::Ip4(ip) if ip.is_private() || ip.is_loopback() || ip.is_link_local())
    })
}

fn has_public_ip(addr: &Multiaddr) -> bool {
    addr.iter().any(|p| {
        matches!(p, Protocol::Ip4(ip) if !ip.is_private() && !ip.is_loopback() && !ip.is_link_local() && !ip.is_unspecified())
    })
}
