/**
 * Update Store
 * 管理自动更新生命周期状态
 */

import { create } from "zustand";
import { getVersion } from "@tauri-apps/api/app";
import { type } from "@tauri-apps/plugin-os";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  checkDesktopUpdate,
  downloadAndInstallUpdate,
  relaunchApp,
} from "@/commands/updater";
import {
  isVersionLessThan,
  type LatestJson,
  type MobileAndroidInfo,
} from "@/lib/version";

export type UpdateStatus =
  | "idle" // 未检查
  | "checking" // 检查中
  | "up-to-date" // 已是最新
  | "available" // 有更新可用
  | "downloading" // 下载中（桌面端）
  | "ready" // 下载完成待重启
  | "error" // 检查/下载失败
  | "force-required"; // 需要强制更新

export interface DownloadProgress {
  downloaded: number;
  total: number;
  /** 字节/秒 */
  speed: number;
  /** 0-100 */
  percent: number;
}

interface UpdateState {
  status: UpdateStatus;
  /** 远程最新版本号 */
  latestVersion: string | null;
  /** 当前应用版本号 */
  currentVersion: string | null;
  /** 最低兼容版本（用于强制更新判断） */
  minVersion: string | null;
  /** 更新日志 */
  releaseNotes: string | null;
  /** 下载进度 */
  progress: DownloadProgress | null;
  /** 错误信息 */
  error: string | null;
  /** 移动端 APK 下载链接 */
  downloadUrl: string | null;

  // === Actions ===

  /** 检查更新（桌面端/移动端自动分流） */
  checkForUpdate: () => Promise<void>;
  /** 下载并安装更新（桌面端） */
  downloadAndInstall: () => Promise<void>;
  /** 打开浏览器下载页（移动端） */
  openDownloadPage: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/** latest.json endpoints（与 tauri.conf.json 保持一致） */
const LATEST_JSON_ENDPOINTS = [
  "https://github.com/yexiyue/SwarmDrop/releases/latest/download/latest.json",
];

/** 获取当前是否为移动端 */
function isMobilePlatform(): boolean {
  const osType = type();
  return osType === "android" || osType === "ios";
}

// 进度计算用的临时变量（不放入 store 避免高频更新引用问题）
let _lastDownloaded = 0;
let _lastSpeedUpdate = 0;
let _currentSpeed = 0;
let _totalSize = 0;

// 桌面端 Update 对象缓存
let _pendingUpdate: import("@tauri-apps/plugin-updater").Update | null = null;

export const useUpdateStore = create<UpdateState>()((set, get) => ({
  status: "idle",
  latestVersion: null,
  currentVersion: null,
  minVersion: null,
  releaseNotes: null,
  progress: null,
  error: null,
  downloadUrl: null,

  async checkForUpdate() {
    const { status } = get();
    if (status === "checking" || status === "downloading") return;

    set({ status: "checking", error: null });

    try {
      const currentVersion = await getVersion();
      set({ currentVersion });

      if (isMobilePlatform()) {
        // === 移动端：fetch latest.json ===
        await checkMobileUpdate(currentVersion, set);
      } else {
        // === 桌面端：tauri-plugin-updater ===
        await checkDesktopUpdateFlow(currentVersion, set);
      }
    } catch (err) {
      console.error("[update-store] checkForUpdate failed:", err);
      set({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async downloadAndInstall() {
    const { status } = get();
    if (status !== "available" && status !== "force-required") return;

    if (!_pendingUpdate) {
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
      await downloadAndInstallUpdate(_pendingUpdate, (downloaded, total) => {
        if (total !== undefined) _totalSize = total;

        // 每 500ms 更新一次速度计算
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

      // 自动重启
      await relaunchApp();
    } catch (err) {
      console.error("[update-store] downloadAndInstall failed:", err);
      set({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async openDownloadPage() {
    const { downloadUrl } = get();
    if (!downloadUrl) return;

    try {
      await openUrl(downloadUrl);
    } catch (err) {
      console.error("[update-store] openDownloadPage failed:", err);
    }
  },

  reset() {
    _pendingUpdate = null;
    set({
      status: "idle",
      latestVersion: null,
      minVersion: null,
      releaseNotes: null,
      progress: null,
      error: null,
      downloadUrl: null,
    });
  },
}));

/** 移动端更新检查 */
async function checkMobileUpdate(
  currentVersion: string,
  set: (state: Partial<UpdateState>) => void,
) {
  let latestJson: LatestJson | null = null;

  for (const endpoint of LATEST_JSON_ENDPOINTS) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        latestJson = await res.json();
        break;
      }
    } catch {
      continue;
    }
  }

  if (!latestJson?.mobile?.android) {
    set({ status: "up-to-date" });
    return;
  }

  const android: MobileAndroidInfo = latestJson.mobile.android;

  set({
    latestVersion: android.version,
    minVersion: android.min_version,
    downloadUrl: android.download_url,
    releaseNotes: latestJson.notes ?? null,
  });

  // 检查是否需要强制更新
  if (android.min_version && isVersionLessThan(currentVersion, android.min_version)) {
    set({ status: "force-required" });
    return;
  }

  // 检查是否有新版本
  if (isVersionLessThan(currentVersion, android.version)) {
    set({ status: "available" });
  } else {
    set({ status: "up-to-date" });
  }
}

/** 桌面端更新检查 */
async function checkDesktopUpdateFlow(
  currentVersion: string,
  set: (state: Partial<UpdateState>) => void,
) {
  const update = await checkDesktopUpdate();

  if (!update) {
    set({ status: "up-to-date" });
    return;
  }

  _pendingUpdate = update;

  set({
    latestVersion: update.version,
    releaseNotes: update.body ?? null,
  });

  // 桌面端也需要检查 min_version（从 latest.json 扩展字段获取）
  // tauri-plugin-updater 的 update 对象不包含自定义字段，
  // 因此额外 fetch latest.json 获取 min_version
  try {
    for (const endpoint of LATEST_JSON_ENDPOINTS) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const json: LatestJson & { min_version?: string } = await res.json();
          const minVersion = json.min_version;
          if (minVersion) {
            set({ minVersion });
            if (isVersionLessThan(currentVersion, minVersion)) {
              set({ status: "force-required" });
              return;
            }
          }
          break;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // min_version 获取失败不影响普通更新流程
  }

  set({ status: "available" });
}
