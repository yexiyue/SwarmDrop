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
    };

/**
 * 启动 P2P 网络节点
 *
 * @param keypair - 节点密钥对（序列化后的字节数组）
 * @param onEvent - 节点事件回调函数
 */
export async function start(
  keypair: number[],
  onEvent: (event: NodeEvent) => void
): Promise<void> {
  const channel = new Channel<NodeEvent>();
  channel.onmessage = onEvent;

  await invoke("start", {
    keypair,
    channel,
  });
}
