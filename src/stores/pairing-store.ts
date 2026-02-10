/**
 * Pairing Store
 * 管理配对流程的状态机
 */

import { create } from "zustand";
import { toast } from "sonner";
import type { PairingCodeInfo, DeviceInfo, PairingResponse } from "@/commands/pairing";
import {
  generatePairingCode,
  getDeviceInfo,
  requestPairing,
  respondPairingRequest,
} from "@/commands/pairing";
import type { AppRequest, PeerId } from "@/commands/network";
import { useSecretStore } from "@/stores/secret-store";
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

/** 配对流程阶段 */
export type PairingPhase =
  | { phase: "idle" }
  | { phase: "generating"; codeInfo: PairingCodeInfo }
  | { phase: "inputting" }
  | { phase: "searching"; code: string }
  | { phase: "found"; code: string; deviceInfo: DeviceInfo }
  | { phase: "requesting"; peerId: string }
  | { phase: "incoming"; peerId: string; pendingId: number; request: AppRequest }
  | { phase: "success"; peerId: string; deviceName: string }
  | { phase: "error"; message: string };

/** 排队的入站请求 */
interface QueuedInboundRequest {
  peerId: PeerId;
  pendingId: number;
  request: AppRequest;
}

interface PairingState {
  /** 当前配对阶段 */
  current: PairingPhase;
  /** 入站请求队列（当前有操作进行中时排队） */
  inboundQueue: QueuedInboundRequest[];

  // === Actions ===

  /** 生成配对码 */
  generateCode: () => Promise<void>;
  /** 重新生成配对码 */
  regenerateCode: () => Promise<void>;
  /** 打开输入配对码弹窗 */
  openInput: () => void;
  /** 提交配对码查找设备 */
  searchDevice: (code: string) => Promise<void>;
  /** 发起配对请求（Code 模式） */
  sendPairingRequest: () => Promise<void>;
  /** 处理收到的入站配对请求 */
  handleInboundRequest: (peerId: PeerId, pendingId: number, request: AppRequest) => void;
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
    inboundQueue: [],

    async generateCode() {
      try {
        const codeInfo = await generatePairingCode(300); // 5 分钟
        set({ current: { phase: "generating", codeInfo } });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
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
        const message = err instanceof Error ? err.message : String(err);
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
          requestPairing(deviceInfo.peerId, { type: "code", code }),
          REQUEST_TIMEOUT_MS,
          "配对请求",
        );

        if (response.status === "success") {
          useSecretStore.getState().addPairedDevice({
            id: deviceInfo.peerId,
            name: deviceInfo.codeRecord.hostname,
            os: deviceInfo.codeRecord.os,
          });
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
        const message = err instanceof Error ? err.message : String(err);
        set({ current: { phase: "error", message } });
        toast.error(message);
      }
    },

    handleInboundRequest(peerId: PeerId, pendingId: number, request: AppRequest) {
      const { current } = get();

      // 如果当前空闲，直接展示
      if (current.phase === "idle" || current.phase === "success" || current.phase === "error") {
        set({
          current: { phase: "incoming", peerId, pendingId, request },
        });
      } else {
        // 当前有操作进行中，排入队列
        set((state) => ({
          inboundQueue: [...state.inboundQueue, { peerId, pendingId, request }],
        }));
      }
    },

    async acceptRequest() {
      const { current } = get();
      if (current.phase !== "incoming") return;

      const { peerId, pendingId, request } = current;
      try {
        await respondPairingRequest(
          pendingId,
          request.method,
          { status: "success" },
        );

        useSecretStore.getState().addPairedDevice({
          id: peerId,
          name: request.osInfo.hostname,
          os: request.osInfo.os,
        });

        set({
          current: {
            phase: "success",
            peerId,
            deviceName: request.osInfo.hostname,
          },
        });
        toast.success(`已与 ${request.osInfo.hostname} 配对成功`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ current: { phase: "error", message } });
        toast.error(message);
      }
    },

    async rejectRequest() {
      const { current } = get();
      if (current.phase !== "incoming") return;

      const { pendingId, request } = current;
      try {
        await respondPairingRequest(
          pendingId,
          request.method,
          { status: "refused", reason: "user_rejected" },
        );
        set({ current: { phase: "idle" } });
        // 处理队列中的下一个请求
        get().processNextInbound();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ current: { phase: "error", message } });
        toast.error(message);
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
          const peerInfo = useNetworkStore.getState().peers.get(peerId);
          const deviceName = peerInfo?.agentInfo?.hostname ?? peerId.slice(0, 8);
          const os = peerInfo?.agentInfo?.os ?? "unknown";

          useSecretStore.getState().addPairedDevice({
            id: peerId,
            name: deviceName,
            os,
          });

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
        const message = err instanceof Error ? err.message : String(err);
        set({ current: { phase: "error", message } });
        toast.error(message);
      }
    },

    processNextInbound() {
      const { inboundQueue } = get();
      if (inboundQueue.length === 0) return;

      const [next, ...rest] = inboundQueue;
      set({
        current: {
          phase: "incoming",
          peerId: next.peerId,
          pendingId: next.pendingId,
          request: next.request,
        },
        inboundQueue: rest,
      });
    },

    reset() {
      // 递增搜索版本以取消进行中的搜索
      searchVersion++;
      set({ current: { phase: "idle" } });
      // 处理队列中的下一个请求
      get().processNextInbound();
    },
  }),
);
