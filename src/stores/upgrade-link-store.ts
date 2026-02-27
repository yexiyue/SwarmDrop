/**
 * UpgradeLink Update Store
 * 使用 Tauri 官方 updater + UpgradeLink 策略
 */

import { create } from "zustand";
import { getVersion } from "@tauri-apps/api/app";
import { platform } from "@tauri-apps/plugin-os";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke, addPluginListener, type PluginListener } from "@tauri-apps/api/core";
import {
  checkForUpdate,
  checkAndroidUpdate,
  executeDesktopUpdate,
  semverToVersionCode,
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
  /** 更新日志 */
  releaseNotes: string | null;
  downloadUrl: string | null;
  progress: DownloadProgress | null;
  error: string | null;
  /** 是否已经检查过更新（避免重复检查） */
  hasChecked: boolean;

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
  releaseNotes: null,
  downloadUrl: null,
  progress: null,
  error: null,
  hasChecked: false,

  async checkForUpdate(force = false) {
    const { status, hasChecked } = get();
    // 如果已经检查过且不是强制检查，则跳过
    if (!force && hasChecked) return;
    if (status === "checking" || status === "downloading") return;

    set({ status: "checking", error: null });

    try {
      const [currentVersion, currentPlatform] = await Promise.all([
        getVersion(),
        platform(),
      ]);

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
    } finally {
      set({ hasChecked: true });
    }
  },

  async executeUpdate() {
    const { status, upgradeType, downloadUrl } = get();
    const currentPlatform = await platform();

    if (status !== "available" && status !== "force-required") return;

    // Android: 调用插件，AppUpdater 后台下载
    if (currentPlatform === "android") {
      if (!downloadUrl) {
        set({ status: "error", error: "No download URL" });
        return;
      }

      try {
        // 调用 Android 更新插件
        await invoke("install_update", {
          url: downloadUrl,
          isForce: upgradeType === "force",
        });

        set({ status: "downloading" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // 权限不足时保持 available 状态，用户授权后可重试
        if (msg.includes("permission")) {
          console.warn("[upgrade] Install permission required, waiting for user");
        } else {
          console.error("[upgrade] Android update failed:", err);
          set({ status: "error", error: msg });
        }
      }
      return;
    }

    // 桌面端: Tauri updater（保持原有逻辑）
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
      releaseNotes: null,
      downloadUrl: null,
      progress: null,
      error: null,
      hasChecked: false,
    });
  },

  /**
   * 设置 Android 下载事件监听器
   * 使用 Tauri Plugin Listener（官方方案）
   */
  async setupAndroidListeners() {
    if (_androidUnlisten) {
      _androidUnlisten();
    }

    const listeners: PluginListener[] = [];

    const PLUGIN_NAME = "android-updater";

    // 监听下载进度
    listeners.push(
      await addPluginListener(PLUGIN_NAME, "download-progress", (payload: { max: number; progress: number }) => {
        const percent = payload.max > 0 ? Math.round((payload.progress / payload.max) * 100) : 0;
        set({
          status: "downloading",
          progress: {
            downloaded: payload.progress,
            total: payload.max,
            speed: 0,
            percent,
          },
        });
      }),
    );

    // 监听下载完成
    listeners.push(
      await addPluginListener(PLUGIN_NAME, "download-done", () => {
        set({ status: "ready" });
      }),
    );

    // 监听下载取消
    listeners.push(
      await addPluginListener(PLUGIN_NAME, "download-cancel", () => {
        set({ status: "idle" });
      }),
    );

    // 监听下载错误
    listeners.push(
      await addPluginListener(PLUGIN_NAME, "download-error", (payload: { error: string }) => {
        set({ status: "error", error: payload.error });
      }),
    );

    // 监听需要安装权限（已打开设置页，用户返回后可重试）
    listeners.push(
      await addPluginListener(PLUGIN_NAME, "install-permission-required", () => {
        console.warn("[upgrade] Install permission required, user redirected to settings");
      }),
    );

    _androidUnlisten = () => listeners.forEach((l) => l.unregister());
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
    releaseNotes: desktopUpdate.body ?? null,
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
    releaseNotes: result.promptContent,
  });

  if (result.upgradeType === "force") {
    set({ status: "force-required" });
  } else {
    set({ status: "available" });
  }
}
