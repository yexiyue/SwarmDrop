/**
 * Network commands
 * P2P 网络相关命令
 */

import { invoke } from "@tauri-apps/api/core";
import type { PairedDevice } from "@/stores/secret-store";

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
export type NatStatus = "public" | "unknown";

// === 后端输出类型 ===

export type DeviceStatus = "online" | "offline";
export type ConnectionType = "lan" | "dcutr" | "relay";
export type NodeStatus = "running" | "stopped";

export interface Device {
  peerId: string;
  hostname: string;
  os: string;
  platform: string;
  arch: string;
  status: DeviceStatus;
  connection?: ConnectionType;
  latency?: number;
  isPaired: boolean;
}

export interface DeviceListResult {
  devices: Device[];
  total: number;
}

export interface NetworkStatus {
  status: NodeStatus;
  peerId: string | null;
  listenAddrs: string[];
  natStatus: NatStatus;
  publicAddr: string | null;
  connectedPeers: number;
  discoveredPeers: number;
}

/**
 * 启动 P2P 网络节点
 * 注意：调用前必须确保 keypair 已通过 register_keypair 注册到后端
 *
 * @param pairedDevices - 已配对设备列表（从 Stronghold 读取）
 */
export async function start(
  pairedDevices: PairedDevice[],
): Promise<void> {
  await invoke("start", { pairedDevices });
}

/**
 * 关闭 P2P 网络节点
 */
export async function shutdown(): Promise<void> {
  await invoke("shutdown");
}

/**
 * 获取设备列表
 * @param filter - 过滤器: "all" | "connected" | "paired"，默认 "connected"
 */
export async function listDevices(
  filter?: "all" | "connected" | "paired",
): Promise<DeviceListResult> {
  return invoke("list_devices", { filter });
}

/**
 * 获取网络状态
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  return invoke("get_network_status");
}
