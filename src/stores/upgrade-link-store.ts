/**
 * UpgradeLink Update Store
 * 使用 Tauri 官方 updater + UpgradeLink 策略
 */

import { create } from "zustand";
import { getVersion } from "@tauri-apps/api/app";
import { platform } from "@tauri-apps/plugin-os";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  checkForUpdate,
  checkAndroidUpdate,
  executeDesktopUpdate,
  type UpgradeType,
} from "@/commands/upgrade";
import {
  check as checkDesktopUpdate,
  type Update,
} from "@tauri-apps/plugin-updater";

export type UpgradeLinkStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "force-required"
  | "downloading"
  | "ready"
  | "error";

interface DownloadProgress {
  downloaded: number;
  total: number;
  speed: number;
  percent: number;
}

interface UpgradeLinkState {
  status: UpgradeLinkStatus;
  upgradeType: UpgradeType;
  latestVersion: string | null;
  currentVersion: string | null;
  promptContent: string | null;
  downloadUrl: string | null;
  progress: DownloadProgress | null;
  error: string | null;

  // Actions
  checkForUpdate: () => Promise<void>;
  executeUpdate: () => Promise<void>;
  openDownloadPage: () => Promise<void>;
  reset: () => void;
  setupAndroidListeners: () => Promise<() => void>;
}

// 桌面端 Update 对象缓存
let _pendingDesktopUpdate: Update | null = null;

// 进度计算
let _lastDownloaded = 0;
let _lastSpeedUpdate = 0;
let _currentSpeed = 0;
let _totalSize = 0;

// Android 监听器取消函数
let _androidUnlisten: (() => void) | null = null;

export const useUpgradeLinkStore = create<UpgradeLinkState>()((set, get) => ({
  status: "idle",
  upgradeType: null,
  latestVersion: null,
  currentVersion: null,
  promptContent: null,
  downloadUrl: null,
  progress: null,
  error: null,

  async checkForUpdate() {
    const { status } = get();
    if (status === "checking" || status === "downloading") return;

    set({ status: "checking", error: null });

    try {
      const currentVersion = await getVersion();
      const currentPlatform = await platform();

      set({ currentVersion });

      if (currentPlatform === "android") {
        // Android: 使用 UpgradeLink SDK
        await checkAndroid(currentVersion, set);
      } else {
        // 桌面端: Tauri updater + UpgradeLink 策略
        await checkDesktop(currentVersion, set);
      }
    } catch (err) {
      console.error("[upgrade] check failed:", err);
      set({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async executeUpdate() {
    const { status, upgradeType, downloadUrl } = get();
    const currentPlatform = await platform();

    if (status !== "available" && status !== "force-required") return;

    // Android: 触发 AppUpdater
    if (currentPlatform === "android") {
      if (!downloadUrl) {
        set({ status: "error", error: "No download URL" });
        return;
      }

      set({ status: "downloading" });

      try {
        await invoke("install_android_update", {
          url: downloadUrl,
          isForce: upgradeType === "force",
        });
      } catch (err) {
        console.error("[upgrade] Android update failed:", err);
        set({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    // 桌面端: Tauri updater
    if (!_pendingDesktopUpdate) {
      set({ status: "error", error: "No update available" });
      return;
    }

    set({
      status: "downloading",
      progress: { downloaded: 0, total: 0, speed: 0, percent: 0 },
    });

    _lastDownloaded = 0;
    _lastSpeedUpdate = Date.now();
    _currentSpeed = 0;

    try {
      await executeDesktopUpdate(_pendingDesktopUpdate, (downloaded, total) => {
        if (total !== undefined) _totalSize = total;

        const now = Date.now();
        if (now - _lastSpeedUpdate > 500) {
          const elapsed = (now - _lastSpeedUpdate) / 1000;
          _currentSpeed =
            elapsed > 0 ? (downloaded - _lastDownloaded) / elapsed : 0;
          _lastDownloaded = downloaded;
          _lastSpeedUpdate = now;
        }

        const percent =
          _totalSize > 0 ? Math.round((downloaded / _totalSize) * 100) : 0;

        set({
          progress: {
            downloaded,
            total: _totalSize,
            speed: _currentSpeed,
            percent,
          },
        });
      });

      set({ status: "ready" });
      // Tauri updater 会自动重启
    } catch (err) {
      console.error("[upgrade] download failed:", err);
      set({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async openDownloadPage() {
    const { downloadUrl } = get();
    if (!downloadUrl) return;
    await openUrl(downloadUrl);
  },

  reset() {
    _pendingDesktopUpdate = null;
    set({
      status: "idle",
      upgradeType: null,
      latestVersion: null,
      currentVersion: null,
      promptContent: null,
      downloadUrl: null,
      progress: null,
      error: null,
    });
  },

  /**
   * 设置 Android 下载事件监听器
   * AppUpdater 使用系统通知栏展示进度，前端只需监听完成/错误事件
   */
  async setupAndroidListeners() {
    if (_androidUnlisten) {
      _androidUnlisten();
    }

    const unlisteners: UnlistenFn[] = [];

    // AppUpdater 在通知栏显示进度，前端无需处理进度事件

    // 监听下载完成
    unlisteners.push(
      await listen("apk-download-done", () => {
        set({ status: "ready" });
        // AppUpdater 已自动触发安装
      }),
    );

    // 监听下载取消
    unlisteners.push(
      await listen("apk-download-cancel", () => {
        set({ status: "idle" });
      }),
    );

    // 监听下载错误
    unlisteners.push(
      await listen("apk-download-error", (e) => {
        const { error } = e.payload as { error: string };
        set({ status: "error", error });
      }),
    );

    // 监听权限授予
    unlisteners.push(
      await listen("apk-install-permission-granted", () => {
        console.log("[upgrade] Install permission granted");
      }),
    );

    _androidUnlisten = () => unlisteners.forEach((fn) => fn());
    return _androidUnlisten;
  },
}));

// 检查桌面端更新
async function checkDesktop(
  _currentVersion: string,
  set: (state: Partial<UpgradeLinkState>) => void,
) {
  // 1. 使用 Tauri 官方 check() 获取更新
  const desktopUpdate = await checkDesktopUpdate({ timeout: 10000 });

  if (!desktopUpdate?.available) {
    set({ status: "up-to-date" });
    return;
  }

  _pendingDesktopUpdate = desktopUpdate;

  // 2. 调用 UpgradeLink 获取策略（轻量级）
  const result = await checkForUpdate();

  set({
    latestVersion: desktopUpdate.version,
    upgradeType: result.upgradeType,
  });

  // 根据策略设置状态
  if (result.upgradeType === "force") {
    set({ status: "force-required" });
  } else {
    set({ status: "available" });
  }
}

// 检查 Android 更新
async function checkAndroid(
  currentVersion: string,
  set: (state: Partial<UpgradeLinkState>) => void,
) {
  const { semverToVersionCode } = await import("@/commands/upgrade");
  const versionCode = semverToVersionCode(currentVersion);

  const result = await checkAndroidUpdate(versionCode);

  if (!result.hasUpdate) {
    set({ status: "up-to-date" });
    return;
  }

  set({
    latestVersion: result.versionName,
    upgradeType: result.upgradeType,
    downloadUrl: result.downloadUrl,
    promptContent: result.promptContent,
  });

  if (result.upgradeType === "force") {
    set({ status: "force-required" });
  } else {
    set({ status: "available" });
  }
}
