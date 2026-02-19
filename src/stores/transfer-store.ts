/**
 * Transfer Store
 * 管理文件传输状态（运行时，不持久化）
 */

import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  TransferSession,
  TransferOfferEvent,
  TransferProgressEvent,
  TransferCompleteEvent,
  TransferFailedEvent,
} from "@/commands/transfer";

interface TransferState {
  /** 活跃传输会话 */
  sessions: Record<string, TransferSession>;
  /** 已完成传输历史（内存中保留，重启后清空） */
  history: TransferSession[];
  /** 待处理的接收请求队列 */
  pendingOffers: TransferOfferEvent[];

  // === Actions ===

  /** 添加传输会话 */
  addSession: (session: TransferSession) => void;
  /** 更新传输进度 */
  updateProgress: (event: TransferProgressEvent) => void;
  /** 完成传输 */
  completeSession: (event: TransferCompleteEvent) => void;
  /** 传输失败 */
  failSession: (event: TransferFailedEvent) => void;
  /** 取消传输 */
  cancelSession: (sessionId: string) => void;
  /** 移除会话（从活跃列表） */
  removeSession: (sessionId: string) => void;
  /** 推入接收请求 */
  pushOffer: (offer: TransferOfferEvent) => void;
  /** 弹出队列首个接收请求 */
  shiftOffer: () => TransferOfferEvent | undefined;
  /** 获取活跃传输数量 */
  getActiveCount: () => number;
}

// 事件监听清理函数
let unlistenFns: UnlistenFn[] = [];

/** 设置传输事件监听 */
export async function setupTransferListeners() {
  await cleanupTransferListeners();

  const fns = await Promise.all([
    // 收到传输提议
    listen<TransferOfferEvent>("transfer-offer", (event) => {
      useTransferStore.getState().pushOffer(event.payload);
    }),

    // 传输进度更新
    listen<TransferProgressEvent>("transfer-progress", (event) => {
      useTransferStore.getState().updateProgress(event.payload);
    }),

    // 传输完成
    listen<TransferCompleteEvent>("transfer-complete", (event) => {
      useTransferStore.getState().completeSession(event.payload);
    }),

    // 传输失败
    listen<TransferFailedEvent>("transfer-failed", (event) => {
      useTransferStore.getState().failSession(event.payload);
    }),
  ]);

  unlistenFns = fns;
}

/** 清理传输事件监听 */
export async function cleanupTransferListeners() {
  for (const unlisten of unlistenFns) {
    unlisten();
  }
  unlistenFns = [];
}

export const useTransferStore = create<TransferState>()((set, get) => ({
  sessions: {},
  history: [],
  pendingOffers: [],

  addSession(session) {
    set((state) => ({
      sessions: { ...state.sessions, [session.sessionId]: session },
    }));
  },

  updateProgress(event) {
    set((state) => {
      const session = state.sessions[event.sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [event.sessionId]: {
            ...session,
            status: "transferring",
            progress: event,
          },
        },
      };
    });
  },

  completeSession(event) {
    set((state) => {
      const session = state.sessions[event.sessionId];
      if (!session) return state;

      const completed: TransferSession = {
        ...session,
        status: "completed",
        completedAt: Date.now(),
        savePath: event.savePath,
      };

      const { [event.sessionId]: _, ...rest } = state.sessions;
      return {
        sessions: rest,
        history: [completed, ...state.history],
      };
    });
  },

  failSession(event) {
    set((state) => {
      const session = state.sessions[event.sessionId];
      if (!session) return state;

      const failed: TransferSession = {
        ...session,
        status: "failed",
        error: event.error,
        completedAt: Date.now(),
      };

      const { [event.sessionId]: _, ...rest } = state.sessions;
      return {
        sessions: rest,
        history: [failed, ...state.history],
      };
    });
  },

  cancelSession(sessionId) {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;

      const cancelled: TransferSession = {
        ...session,
        status: "cancelled",
        completedAt: Date.now(),
      };

      const { [sessionId]: _, ...rest } = state.sessions;
      return {
        sessions: rest,
        history: [cancelled, ...state.history],
      };
    });
  },

  removeSession(sessionId) {
    set((state) => {
      const { [sessionId]: _, ...rest } = state.sessions;
      return { sessions: rest };
    });
  },

  pushOffer(offer) {
    set((state) => ({
      pendingOffers: [...state.pendingOffers, offer],
    }));
  },

  shiftOffer() {
    const { pendingOffers } = get();
    if (pendingOffers.length === 0) return undefined;
    const [first, ...rest] = pendingOffers;
    set({ pendingOffers: rest });
    return first;
  },

  getActiveCount() {
    return Object.keys(get().sessions).length;
  },
}));
