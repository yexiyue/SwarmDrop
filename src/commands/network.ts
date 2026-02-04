/**
 * Network commands
 * P2P 网络相关命令
 */

import { Channel, invoke } from "@tauri-apps/api/core";

/**
 * Peer ID (libp2p 节点标识)
 */
export type PeerId = string;

/**
 * Multiaddr (libp2p 多地址)
 */
export type Multiaddr = string;

/**
 * NAT 状态
 */
export type NatStatus = "public" | "private" | "unknown";

/**
 * P2P 节点事件类型
 * 对应后端 swarm_p2p_core::NodeEvent
 */
export type NodeEvent =
  | { type: "listening"; addr: Multiaddr }
  | { type: "peersDiscovered"; peers: [PeerId, Multiaddr][] }
  | { type: "peerConnected"; peerId: PeerId }
  | { type: "peerDisconnected"; peerId: PeerId }
  | {
      type: "identifyReceived";
      peerId: PeerId;
      agentVersion: string;
      protocolVersion: string;
    }
  | { type: "pingSuccess"; peerId: PeerId; rttMs: number }
  | { type: "natStatusChanged"; status: NatStatus; publicAddr: Multiaddr | null };

/**
 * 启动 P2P 网络节点
 * 注意：调用前必须确保 keypair 已通过 register_keypair 注册到后端
 *
 * @param onEvent - 节点事件回调函数
 */
export async function start(onEvent: (event: NodeEvent) => void): Promise<void> {
  const channel = new Channel<NodeEvent>();
  channel.onmessage = onEvent;

  await invoke("start", { channel });
}

/**
 * 关闭 P2P 网络节点
 */
export async function shutdown(): Promise<void> {
  await invoke("shutdown");
}
