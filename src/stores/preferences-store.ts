/**
 * Preferences Store
 * 管理用户偏好设置（主题、语言、设备名称等）
 * 使用 tauri-plugin-store 持久化到应用配置目录，无需加密保护
 */

import { createWithEqualityFn } from "zustand/traditional";
import { createJSONStorage, persist } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import { createTauriStorage } from "@/lib/tauri-store";
import { dynamicActivate, defaultLocale, type LocaleKey } from "@/lib/i18n";

export type Theme = "light" | "dark" | "system";

interface PreferencesState {
  /** 主题模式 */
  theme: Theme;
  /** 语言 */
  locale: LocaleKey;
  /** 自定义设备名称（为空时使用系统主机名） */
  deviceName: string;

  // === Actions ===

  /** 设置主题并应用到 DOM */
  setTheme: (theme: Theme) => void;
  /** 设置语言并激活 */
  setLocale: (locale: LocaleKey) => Promise<void>;
  /** 设置设备名称 */
  setDeviceName: (name: string) => void;
  /** 应用当前主题到 DOM（初始化时调用） */
  applyTheme: () => void;
}

/** 根据主题设置更新 DOM */
function applyThemeToDOM(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", isDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
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

export const usePreferencesStore = createWithEqualityFn<PreferencesState>()(
  persist(
    (set, get) => ({
      theme: "system",
      locale: defaultLocale,
      deviceName: "",

      setTheme(theme: Theme) {
        set({ theme });
        applyThemeToDOM(theme);
      },

      async setLocale(locale: LocaleKey) {
        await dynamicActivate(locale);
        set({ locale });
      },

      setDeviceName(name: string) {
        set({ deviceName: name });
      },

      applyTheme() {
        applyThemeToDOM(get().theme);
      },
    }),
    {
      name: "preferences-store",
      storage: createJSONStorage(() => createTauriStorage("preferences.json")),
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
        deviceName: state.deviceName,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            // hydration 完成后立即应用主题和语言，避免闪烁
            applyThemeToDOM(state.theme);
            dynamicActivate(state.locale);
          }
        };
      },
    }
  ),
  shallow
);
