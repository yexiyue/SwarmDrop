/**
 * Pairing Store
 * 管理配对流程的状态机
 */

import { create } from "zustand";
import { toast } from "sonner";
import type { PairingCodeInfo, DeviceInfo, PairingResponse, PairingMethod } from "@/commands/pairing";
import {
  generatePairingCode,
  getDeviceInfo,
  requestPairing,
  respondPairingRequest,
} from "@/commands/pairing";
import type { PeerId } from "@/commands/network";
import { isErrorKind, getErrorMessage } from "@/lib/errors";
import { useNetworkStore } from "@/stores/network-store";

/** 请求超时时间（毫秒） */
const REQUEST_TIMEOUT_MS = 30_000;

/** 搜索超时时间（毫秒） */
const SEARCH_TIMEOUT_MS = 15_000;

/** 搜索请求版本号，用于取消过期搜索 */
let searchVersion = 0;

/** 带超时的 Promise 包装 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}超时（${ms / 1000}s）`)), ms),
    ),
  ]);
}

/** 检查是否为 NodeNotStarted 错误，如果是则弹出启动提示并返回 true */
function handleNodeNotStarted(err: unknown): boolean {
  if (!isErrorKind(err, "NodeNotStarted")) return false;
  toast.error("节点未启动", {
    description: "请先启动网络节点",
    action: {
      label: "启动",
      onClick: () => useNetworkStore.getState().startNetwork(),
    },
  });
  return true;
}

/** 配对流程阶段（仅管理出站配对流程） */
export type PairingPhase =
  | { phase: "idle" }
  | { phase: "generating"; codeInfo: PairingCodeInfo }
  | { phase: "inputting" }
  | { phase: "searching"; code: string }
  | { phase: "found"; code: string; deviceInfo: DeviceInfo }
  | { phase: "requesting"; peerId: string }
  | { phase: "success"; peerId: string; deviceName: string }
  | { phase: "error"; message: string };

/** 入站配对请求（对应后端 PairingRequestPayload，flatten 了 PairingRequest） */
interface QueuedInboundRequest {
  peerId: PeerId;
  pendingId: number;
  osInfo: { hostname: string; os: string; platform: string; arch: string };
  timestamp: number;
  method: PairingMethod;
}

interface PairingState {
  /** 当前出站配对阶段 */
  current: PairingPhase;
  /** 当前展示的入站配对请求（独立于出站流程） */
  incomingRequest: QueuedInboundRequest | null;
  /** 入站请求队列（当前已有入站请求展示时排队） */
  inboundQueue: QueuedInboundRequest[];

  // === Actions ===

  /** 生成配对码 */
  generateCode: () => Promise<void>;
  /** 重新生成配对码 */
  regenerateCode: () => Promise<void>;
  /** 切换到输入配对码状态 */
  openInput: () => void;
  /** 提交配对码查找设备 */
  searchDevice: (code: string) => Promise<void>;
  /** 发起配对请求（Code 模式） */
  sendPairingRequest: () => Promise<void>;
  /** 处理收到的入站配对请求 */
  handleInboundRequest: (payload: QueuedInboundRequest) => void;
  /** 接受配对请求 */
  acceptRequest: () => Promise<void>;
  /** 拒绝配对请求 */
  rejectRequest: () => Promise<void>;
  /** Direct 模式配对（附近设备直连） */
  directPairing: (peerId: PeerId) => Promise<void>;
  /** 处理队列中的下一个入站请求 */
  processNextInbound: () => void;
  /** 重置为 idle 状态 */
  reset: () => void;
}

export const usePairingStore = create<PairingState>()(
  (set, get) => ({
    current: { phase: "idle" },
    incomingRequest: null,
    inboundQueue: [],

    async generateCode() {
      try {
        const codeInfo = await generatePairingCode(300); // 5 分钟
        set({ current: { phase: "generating", codeInfo } });
      } catch (err) {
        if (handleNodeNotStarted(err)) return;
        const message = getErrorMessage(err);
        set({ current: { phase: "error", message } });
        toast.error(message);
      }
    },

    async regenerateCode() {
      return get().generateCode();
    },

    openInput() {
      set({ current: { phase: "inputting" } });
    },

    async searchDevice(code: string) {
      const version = ++searchVersion;
      set({ current: { phase: "searching", code } });
      try {
        const deviceInfo = await withTimeout(
          getDeviceInfo(code),
          SEARCH_TIMEOUT_MS,
          "查找设备",
        );
        // 如果版本号不匹配，说明已被取消/重置
        if (searchVersion !== version) return;
        set({ current: { phase: "found", code, deviceInfo } });
      } catch (err) {
        if (searchVersion !== version) return;
        if (handleNodeNotStarted(err)) return;
        const message = getErrorMessage(err);
        set({ current: { phase: "error", message } });
        toast.error(message);
      }
    },

    async sendPairingRequest() {
      const { current } = get();
      if (current.phase !== "found") return;

      const { code, deviceInfo } = current;
      set({ current: { phase: "requesting", peerId: deviceInfo.peerId } });

      try {
        const response: PairingResponse = await withTimeout(
          requestPairing(deviceInfo.peerId, { type: "code", code }, deviceInfo.codeRecord.listenAddrs),
          REQUEST_TIMEOUT_MS,
          "配对请求",
        );

        if (response.status === "success") {
          // 已配对设备由后端通过 paired-device-added 事件同步到 Stronghold
          set({
            current: {
              phase: "success",
              peerId: deviceInfo.peerId,
              deviceName: deviceInfo.codeRecord.hostname,
            },
          });
          toast.success(`已与 ${deviceInfo.codeRecord.hostname} 配对成功`);
        } else {
          set({ current: { phase: "error", message: response.reason } });
          toast.error(response.reason);
        }
      } catch (err) {
        if (handleNodeNotStarted(err)) return;
        const message = getErrorMessage(err);
        set({ current: { phase: "error", message } });
        toast.error(message);
      }
    },

    handleInboundRequest(payload: QueuedInboundRequest) {
      const { incomingRequest } = get();

      if (incomingRequest === null) {
        set({ incomingRequest: payload });
      } else {
        set((state) => ({
          inboundQueue: [...state.inboundQueue, payload],
        }));
      }
    },

    async acceptRequest() {
      const { incomingRequest, current } = get();
      if (!incomingRequest) return;

      const { pendingId, osInfo, method } = incomingRequest;
      try {
        await respondPairingRequest(
          pendingId,
          method,
          { status: "success" },
        );

        // 已配对设备由后端通过 paired-device-added 事件同步到 Stronghold
        set({ incomingRequest: null });
        toast.success(`已与 ${osInfo.hostname} 配对成功`);
        // 处理队列中的下一个请求
        get().processNextInbound();

        // Code 模式配对成功后，后端已消耗活跃码（单例设计）
        if (method.type === "code") {
          // 清理队列中其他 Code 模式请求——旧码已失效，继续展示只会报错
          set((state) => ({
            inboundQueue: state.inboundQueue.filter((r) => r.method.type !== "code"),
          }));
          // 若当前仍在展示配对码，自动重新生成
          if (current.phase === "generating") {
            void get().generateCode();
          }
        }
      } catch (err) {
        if (handleNodeNotStarted(err)) return;
        const message = getErrorMessage(err);
        set({ incomingRequest: null });
        toast.error(message);
        get().processNextInbound();
      }
    },

    async rejectRequest() {
      const { incomingRequest } = get();
      if (!incomingRequest) return;

      const { pendingId, osInfo, method } = incomingRequest;
      try {
        await respondPairingRequest(
          pendingId,
          method,
          { status: "refused", reason: "user_rejected" },
        );
        set({ incomingRequest: null });
        toast.success(`已拒绝来自 ${osInfo.hostname} 的配对请求`);
        // 处理队列中的下一个请求
        get().processNextInbound();
      } catch (err) {
        if (handleNodeNotStarted(err)) return;
        const message = getErrorMessage(err);
        set({ incomingRequest: null });
        toast.error(message);
        get().processNextInbound();
      }
    },

    async directPairing(peerId: PeerId) {
      set({ current: { phase: "requesting", peerId } });

      try {
        const response: PairingResponse = await withTimeout(
          requestPairing(peerId, { type: "direct" }),
          REQUEST_TIMEOUT_MS,
          "配对请求",
        );

        if (response.status === "success") {
          // 已配对设备由后端通过 paired-device-added 事件同步到 Stronghold
          const device = useNetworkStore.getState().devices.find(d => d.peerId === peerId);
          const deviceName = device?.hostname ?? peerId.slice(0, 8);

          set({
            current: {
              phase: "success",
              peerId,
              deviceName,
            },
          });
          toast.success(`已与 ${deviceName} 配对成功`);
        } else {
          set({ current: { phase: "error", message: response.reason } });
          toast.error(response.reason);
        }
      } catch (err) {
        if (handleNodeNotStarted(err)) return;
        const message = getErrorMessage(err);
        set({ current: { phase: "error", message } });
        toast.error(message);
      }
    },

    processNextInbound() {
      const { inboundQueue } = get();
      if (inboundQueue.length === 0) return;

      const [next, ...rest] = inboundQueue;
      set({
        incomingRequest: next,
        inboundQueue: rest,
      });
    },

    reset() {
      // 递增搜索版本以取消进行中的搜索
      searchVersion++;
      set({ current: { phase: "idle" } });
    },

  }),
);
