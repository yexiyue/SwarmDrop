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

  // === Actions ===

  /** 设置语言并激活 */
  setLocale: (locale: LocaleKey) => Promise<void>;
  /** 设置设备名称 */
  setDeviceName: (name: string) => void;
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

      async setLocale(locale: LocaleKey) {
        await dynamicActivate(locale);
        set({ locale });
      },

      setDeviceName(name: string) {
        set({ deviceName: name });
      },
    }),
    {
      name: "preferences-store",
      storage: createJSONStorage(() => createTauriStorage("preferences.json")),
      partialize: (state) => ({
        locale: state.locale,
        deviceName: state.deviceName,
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
