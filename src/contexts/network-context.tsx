/**
 * Network Context
 * 管理 P2P 网络节点状态
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  start,
  type Multiaddr,
  type NodeEvent,
  type PeerId,
} from "@/commands/network";

export type NodeStatus = "stopped" | "starting" | "running" | "error";

interface NetworkState {
  status: NodeStatus;
  listeningAddrs: Multiaddr[];
  connectedPeers: Set<PeerId>;
  discoveredPeers: Map<PeerId, Multiaddr>;
  error: string | null;
}

interface NetworkContextValue extends NetworkState {
  startNode: () => Promise<void>;
  stopNode: () => void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NetworkState>({
    status: "stopped",
    listeningAddrs: [],
    connectedPeers: new Set(),
    discoveredPeers: new Map(),
    error: null,
  });

  const handleNodeEvent = useCallback((event: NodeEvent) => {
    console.log("Network event:", event);
    switch (event.type) {
      case "listening":
        setState((prev) => ({
          ...prev,
          status: "running",
          listeningAddrs: [...prev.listeningAddrs, event.addr],
        }));
        break;

      case "peersDiscovered":
        setState((prev) => {
          const newDiscovered = new Map(prev.discoveredPeers);
          for (const [peerId, addr] of event.peers) {
            newDiscovered.set(peerId, addr);
          }
          return { ...prev, discoveredPeers: newDiscovered };
        });
        break;

      case "peerConnected":
        setState((prev) => {
          const newConnected = new Set(prev.connectedPeers);
          newConnected.add(event.peerId);
          return { ...prev, connectedPeers: newConnected };
        });
        break;

      case "peerDisconnected":
        setState((prev) => {
          const newConnected = new Set(prev.connectedPeers);
          newConnected.delete(event.peerId);
          return { ...prev, connectedPeers: newConnected };
        });
        break;

      case "identifyReceived":
        // 可以在这里处理节点身份信息
        break;
    }
  }, []);

  const startNode = useCallback(async () => {
    if (state.status === "running" || state.status === "starting") {
      return;
    }

    setState((prev) => ({
      ...prev,
      status: "starting",
      error: null,
      listeningAddrs: [],
      connectedPeers: new Set(),
      discoveredPeers: new Map(),
    }));

    try {
      // TODO: 从存储中获取或生成密钥对
      // 目前使用空数组，后端应该会生成新的密钥对
      const keypair: number[] = [];
      await start(keypair, handleNodeEvent);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [state.status, handleNodeEvent]);

  const stopNode = useCallback(() => {
    // TODO: 实现停止节点的命令
    setState({
      status: "stopped",
      listeningAddrs: [],
      connectedPeers: new Set(),
      discoveredPeers: new Map(),
      error: null,
    });
  }, []);

  const value = useMemo<NetworkContextValue>(
    () => ({
      ...state,
      startNode,
      stopNode,
    }),
    [state, startNode, stopNode],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
