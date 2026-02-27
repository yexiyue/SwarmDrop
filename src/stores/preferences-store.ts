/**
 * Preferences Store
 * 管理用户偏好设置（主题、语言、设备名称等）
 * 使用 tauri-plugin-store 持久化到应用配置目录，无需加密保护
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createTauriStorage } from "@/lib/tauri-store";
import { dynamicActivate, defaultLocale, type LocaleKey } from "@/lib/i18n";

interface PreferencesState {
  /** 语言 */
  locale: LocaleKey;
  /** 自定义设备名称（为空时使用系统主机名） */
  deviceName: string;
  /** 解锁后自动启动 P2P 节点 */
  autoStart: boolean;
  /** 自定义引导节点地址列表（Multiaddr 格式） */
  customBootstrapNodes: string[];
  /** 文件传输设置 */
  transfer: {
    /** 接收文件的默认保存路径 */
    savePath: string;
    /** 是否自动接受已配对设备的文件 */
    autoAccept: boolean;
  };

  // === Actions ===

  /** 设置语言并激活 */
  setLocale: (locale: LocaleKey) => Promise<void>;
  /** 设置设备名称 */
  setDeviceName: (name: string) => void;
  /** 设置自动启动 */
  setAutoStart: (autoStart: boolean) => void;
  /** 添加自定义引导节点 */
  addBootstrapNode: (addr: string) => void;
  /** 删除自定义引导节点 */
  removeBootstrapNode: (addr: string) => void;
  /** 设置传输保存路径 */
  setTransferSavePath: (path: string) => void;
  /** 设置自动接收 */
  setTransferAutoAccept: (autoAccept: boolean) => void;
}

/**
 * 等待偏好设置 hydration 完成
 * 在 main.tsx 初始化时调用，确保主题/语言在渲染前就绑定
 */
export function waitForPreferencesHydration(): Promise<void> {
  return new Promise((resolve) => {
    if (usePreferencesStore.persist.hasHydrated()) {
      resolve();
    } else {
      usePreferencesStore.persist.onFinishHydration(() => resolve());
    }
  });
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: defaultLocale,
      deviceName: "",
      autoStart: false,
      customBootstrapNodes: [],
      transfer: {
        savePath: "",
        autoAccept: false,
      },

      async setLocale(locale: LocaleKey) {
        await dynamicActivate(locale);
        set({ locale });
      },

      setDeviceName(name: string) {
        set({ deviceName: name });
      },

      setAutoStart(autoStart: boolean) {
        set({ autoStart });
      },

      addBootstrapNode(addr: string) {
        set((state) => ({
          customBootstrapNodes: [...state.customBootstrapNodes, addr],
        }));
      },

      removeBootstrapNode(addr: string) {
        set((state) => ({
          customBootstrapNodes: state.customBootstrapNodes.filter((n) => n !== addr),
        }));
      },

      setTransferSavePath(path: string) {
        set((state) => ({
          transfer: { ...state.transfer, savePath: path },
        }));
      },

      setTransferAutoAccept(autoAccept: boolean) {
        set((state) => ({
          transfer: { ...state.transfer, autoAccept },
        }));
      },
    }),
    {
      name: "preferences-store",
      storage: createJSONStorage(() => createTauriStorage("preferences.json")),
      partialize: (state) => ({
        locale: state.locale,
        deviceName: state.deviceName,
        autoStart: state.autoStart,
        customBootstrapNodes: state.customBootstrapNodes,
        transfer: state.transfer,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            // hydration 完成后立即激活语言
            dynamicActivate(state.locale);
          }
        };
      },
    }
  )
);
