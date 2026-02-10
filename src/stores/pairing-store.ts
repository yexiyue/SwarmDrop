/**
 * Pairing Store
 * 管理配对流程的状态机
 */

import { create } from "zustand";
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

interface PairingState {
  /** 当前配对阶段 */
  current: PairingPhase;

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
  /** 重置为 idle 状态 */
  reset: () => void;
}

export const usePairingStore = create<PairingState>()(
  (set, get) => ({
    current: { phase: "idle" },

    async generateCode() {
      try {
        const codeInfo = await generatePairingCode(300); // 5 分钟
        set({ current: { phase: "generating", codeInfo } });
      } catch (err) {
        set({
          current: {
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        });
      }
    },

    async regenerateCode() {
      // 与 generateCode 相同逻辑，后端会生成新码
      return get().generateCode();
    },

    openInput() {
      set({ current: { phase: "inputting" } });
    },

    async searchDevice(code: string) {
      set({ current: { phase: "searching", code } });
      try {
        const deviceInfo = await getDeviceInfo(code);
        set({ current: { phase: "found", code, deviceInfo } });
      } catch (err) {
        set({
          current: {
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        });
      }
    },

    async sendPairingRequest() {
      const { current } = get();
      if (current.phase !== "found") return;

      const { code, deviceInfo } = current;
      set({ current: { phase: "requesting", peerId: deviceInfo.peerId } });

      try {
        const response: PairingResponse = await requestPairing(
          deviceInfo.peerId,
          { type: "code", code }
        );

        if (response.status === "success") {
          // 配对成功，添加到已配对设备
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
        } else {
          set({
            current: {
              phase: "error",
              message: response.reason,
            },
          });
        }
      } catch (err) {
        set({
          current: {
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        });
      }
    },

    handleInboundRequest(peerId: PeerId, pendingId: number, request: AppRequest) {
      set({
        current: { phase: "incoming", peerId, pendingId, request },
      });
    },

    async acceptRequest() {
      const { current } = get();
      if (current.phase !== "incoming") return;

      const { peerId, pendingId, request } = current;
      try {
        await respondPairingRequest(
          pendingId,
          request.method,
          { status: "success" }
        );

        // 配对成功，添加到已配对设备
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
      } catch (err) {
        set({
          current: {
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        });
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
          { status: "refused", reason: "用户拒绝" }
        );
        set({ current: { phase: "idle" } });
      } catch (err) {
        set({
          current: {
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        });
      }
    },

    async directPairing(peerId: PeerId) {
      set({ current: { phase: "requesting", peerId } });

      try {
        const response: PairingResponse = await requestPairing(
          peerId,
          { type: "direct" }
        );

        if (response.status === "success") {
          // 从 network store 获取 peer 的设备信息
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
        } else {
          set({
            current: {
              phase: "error",
              message: response.reason,
            },
          });
        }
      } catch (err) {
        set({
          current: {
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        });
      }
    },

    reset() {
      set({ current: { phase: "idle" } });
    },
  })
);
