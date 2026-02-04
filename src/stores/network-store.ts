/**
 * Network Store
 * 管理 P2P 网络状态和设备列表
 */

import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import type { Device, DeviceType, ConnectionType } from "@/components/devices/device-card";
import type { NodeEvent, PeerId, Multiaddr, NatStatus } from "@/commands/network";
import { start, shutdown } from "@/commands/network";
import { useSecretStore } from "@/stores/secret-store";

/** 节点状态 */
export type NodeStatus = "stopped" | "starting" | "running" | "error";

/** 解析后的 Agent 信息 */
interface AgentInfo {
  version: string;
  os: string;
  arch: string;
  hostname: string;
}

/** Peer 信息（内部使用） */
interface PeerInfo {
  peerId: PeerId;
  addrs: Multiaddr[];
  agentInfo?: AgentInfo;
  rttMs?: number;
  isConnected: boolean;
  discoveredAt: number;
  connectedAt?: number;
}

interface NetworkState {
  /** 节点状态 */
  status: NodeStatus;
  /** 监听地址列表 */
  listenAddrs: Multiaddr[];
  /** NAT 状态 */
  natStatus: NatStatus;
  /** 公网地址（如果有） */
  publicAddr: Multiaddr | null;
  /** Peer 信息 Map */
  peers: Map<PeerId, PeerInfo>;
  /** 错误信息 */
  error: string | null;

  // === Actions ===

  /** 启动网络 */
  startNetwork: () => Promise<void>;
  /** 停止网络 */
  stopNetwork: () => Promise<void>;
  /** 处理节点事件 */
  handleEvent: (event: NodeEvent) => void;
  /** 获取附近设备列表（未配对） */
  getNearbyDevices: () => Device[];
  /** 获取已连接的 peer 数量 */
  getConnectedCount: () => number;
  /** 获取已发现的 peer 数量 */
  getDiscoveredCount: () => number;
  /** 清除错误 */
  clearError: () => void;
}

/**
 * 解析 agent_version 字符串
 * 格式: swarmdrop/{version}; os={os}; arch={arch}; host={hostname}
 */
function parseAgentVersion(agentVersion: string): AgentInfo | undefined {
  // 匹配格式: swarmdrop/x.x.x; os=xxx; arch=xxx; host=xxx
  const match = agentVersion.match(
    /^swarmdrop\/([^;]+);\s*os=([^;]+);\s*arch=([^;]+);\s*host=(.+)$/
  );

  if (!match) return undefined;

  return {
    version: match[1],
    os: match[2],
    arch: match[3],
    hostname: match[4],
  };
}

/**
 * 根据 OS 推断设备类型
 */
export function inferDeviceType(os: string): DeviceType {
  const osLower = os.toLowerCase();
  if (osLower === "ios") return "smartphone";
  if (osLower === "android") return "smartphone";
  if (osLower === "macos" || osLower === "darwin") return "laptop";
  if (osLower === "windows") return "desktop";
  if (osLower === "linux") return "desktop";
  return "desktop"; // 默认
}

/**
 * 根据延迟推断连接类型
 */
export function inferConnectionType(rttMs?: number): ConnectionType {
  if (rttMs === undefined) return "none";
  if (rttMs < 10) return "lan"; // < 10ms 认为是局域网
  if (rttMs < 100) return "dcutr"; // < 100ms 认为是打洞成功
  return "relay"; // >= 100ms 认为是中继
}

/**
 * 将 PeerInfo 转换为 Device
 */
export function peerToDevice(peer: PeerInfo): Device {
  const agentInfo = peer.agentInfo;
  const name = agentInfo?.hostname ?? peer.peerId.slice(0, 8);
  const deviceType = agentInfo ? inferDeviceType(agentInfo.os) : "desktop";
  const connection = inferConnectionType(peer.rttMs);

  return {
    id: peer.peerId,
    name,
    type: deviceType,
    status: peer.isConnected ? "online" : "offline",
    connection: peer.isConnected ? connection : undefined,
    latency: peer.isConnected ? peer.rttMs : undefined,
    isPaired: false, // 目前都是未配对的附近设备
  };
}

// === Selectors ===

/** 选择附近设备列表 */
export const selectNearbyDevices = (state: NetworkState): Device[] =>
  Array.from(state.peers.values())
    .filter((peer) => peer.isConnected)
    .map(peerToDevice);

/** 选择已连接的 peer 数量 */
export const selectConnectedCount = (state: NetworkState): number =>
  Array.from(state.peers.values()).filter((p) => p.isConnected).length;

/** 选择已发现的 peer 数量 */
export const selectDiscoveredCount = (state: NetworkState): number =>
  state.peers.size;

export const useNetworkStore = createWithEqualityFn<NetworkState>()(
  (set, get) => ({
  status: "stopped",
  listenAddrs: [],
  natStatus: "unknown",
  publicAddr: null,
  peers: new Map(),
  error: null,

  async startNetwork() {
    const { status } = get();
    if (status === "running" || status === "starting") return;

    // 检查 keypair 是否已初始化
    const { deviceId } = useSecretStore.getState();
    if (!deviceId) {
      set({ status: "error", error: "Keypair not initialized" });
      return;
    }

    set({
      status: "starting",
      error: null,
      listenAddrs: [],
      peers: new Map(),
      natStatus: "unknown",
      publicAddr: null,
    });

    try {
      await start(get().handleEvent);
      // status 会在收到 listening 事件后更新为 running
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async stopNetwork() {
    const { status } = get();
    if (status !== "running") return;

    try {
      await shutdown();
      set({
        status: "stopped",
        listenAddrs: [],
        peers: new Map(),
        natStatus: "unknown",
        publicAddr: null,
      });
    } catch (err) {
      console.error("Failed to shutdown node:", err);
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  handleEvent(event: NodeEvent) {
    const { peers } = get();
    console.log("Network event:", event);

    switch (event.type) {
      case "listening": {
        set((state) => ({
          status: "running",
          listenAddrs: [...state.listenAddrs, event.addr],
        }));
        break;
      }

      case "peersDiscovered": {
        const newPeers = new Map(peers);
        const now = Date.now();

        for (const [peerId, addr] of event.peers) {
          const existing = newPeers.get(peerId);
          if (existing) {
            // 创建新对象更新地址（不可变性）
            if (!existing.addrs.includes(addr)) {
              newPeers.set(peerId, {
                ...existing,
                addrs: [...existing.addrs, addr],
              });
            }
          } else {
            // 新 peer
            newPeers.set(peerId, {
              peerId,
              addrs: [addr],
              isConnected: false,
              discoveredAt: now,
            });
          }
        }

        set({ peers: newPeers });
        break;
      }

      case "peerConnected": {
        const newPeers = new Map(peers);
        const existing = newPeers.get(event.peerId);

        if (existing) {
          // 创建新对象（不可变性）
          newPeers.set(event.peerId, {
            ...existing,
            isConnected: true,
            connectedAt: Date.now(),
          });
        } else {
          newPeers.set(event.peerId, {
            peerId: event.peerId,
            addrs: [],
            isConnected: true,
            discoveredAt: Date.now(),
            connectedAt: Date.now(),
          });
        }

        set({ peers: newPeers });
        break;
      }

      case "peerDisconnected": {
        const newPeers = new Map(peers);
        const existing = newPeers.get(event.peerId);

        if (existing) {
          // 创建新对象（不可变性）
          newPeers.set(event.peerId, {
            ...existing,
            isConnected: false,
            connectedAt: undefined,
            rttMs: undefined,
          });
        }

        set({ peers: newPeers });
        break;
      }

      case "identifyReceived": {
        const newPeers = new Map(peers);
        const existing = newPeers.get(event.peerId);

        if (existing) {
          // 创建新对象（不可变性）
          newPeers.set(event.peerId, {
            ...existing,
            agentInfo: parseAgentVersion(event.agentVersion),
          });
        }

        set({ peers: newPeers });
        break;
      }

      case "pingSuccess": {
        const newPeers = new Map(peers);
        const existing = newPeers.get(event.peerId);

        if (existing) {
          // 创建新对象（不可变性）
          newPeers.set(event.peerId, {
            ...existing,
            rttMs: event.rttMs,
          });
        }

        set({ peers: newPeers });
        break;
      }

      case "natStatusChanged": {
        set({
          natStatus: event.status,
          publicAddr: event.publicAddr,
        });
        break;
      }
    }
  },

  getNearbyDevices(): Device[] {
    const { peers } = get();
    return Array.from(peers.values())
      .filter((peer) => peer.isConnected)
      .map(peerToDevice);
  },

  getConnectedCount(): number {
    const { peers } = get();
    return Array.from(peers.values()).filter((p) => p.isConnected).length;
  },

  getDiscoveredCount(): number {
    return get().peers.size;
  },

  clearError() {
    set({ error: null });
  },
  }),
  shallow
);
