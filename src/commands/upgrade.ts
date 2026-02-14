/**
 * UpgradeLink SDK Integration
 * 使用 Tauri 官方 updater 配合 UpgradeLink 端点
 */

import { check, type Update } from "@tauri-apps/plugin-updater";
import { platform, arch } from "@tauri-apps/plugin-os";

// 升级策略类型
export type UpgradeType = "force" | "prompt" | "silent" | null;

// 升级信息接口
export interface UpdateInfo {
  upgradeType?: UpgradeType;
  rawJson?: {
    upgradeType?: number;
    [key: string]: unknown;
  };
}

// 升级信息接口
export interface UpgradeCheckResult {
  hasUpdate: boolean;
  update: UpdateInfo | null;
  version: string | null;
  upgradeType: UpgradeType;
}

// UpgradeLink 应用密钥配置
// 注意：生产环境应该从环境变量读取
const UPGRADELINK_KEYS = {
  // Tauri 应用 Key
  tauriKey: "LeRhLvlkcdd1FX0etgOJaw",
  // Android 应用 Key
  apkKey: "y1uazDtYlT_UrgDk6UeQmA",
  // Access Key (用于 API 调用)
  accessKey: "bnJ5md-5YtXhz-i710U8oA",
};

/**
 * 检查更新（使用 Tauri 官方 updater + UpgradeLink 端点）
 * 
 * tauri.conf.json 中配置 UpgradeLink 端点：
 * "endpoints": [
 *   "https://api.upgrade.toolsetlink.com/v1/tauri/upgrade?tauriKey=xxx&versionName={{current_version}}&target={{target}}&arch={{arch}}"
 * ]
 */
export async function checkForUpdate(): Promise<UpgradeCheckResult> {
  try {
    // 使用 Tauri 官方 check()，它会调用 tauri.conf.json 中配置的 UpgradeLink 端点
    const update = await check({
      timeout: 10000,
      // 添加 UpgradeLink 认证头
      headers: {
        'X-AccessKey': UPGRADELINK_KEYS.accessKey,
      },
    });

    if (!update?.available) {
      return {
        hasUpdate: false,
        update: null,
        version: null,
        upgradeType: null,
      };
    }

    // 从 update 的 raw body 中解析 upgradeType
    // 注意：Tauri 的 Update 类型可能不包含 upgradeType，需要通过其他方式获取
    // 方案：调用 UpgradeLink SDK 获取策略（轻量级查询）
    const upgradeType = await fetchUpgradeType(update.version);

    return {
      hasUpdate: true,
      update: update as UpdateInfo,
      version: update.version,
      upgradeType,
    };
  } catch (error) {
    console.error("[upgrade] Failed to check update:", error);
    return {
      hasUpdate: false,
      update: null,
      version: null,
      upgradeType: null,
    };
  }
}

/**
 * 获取升级策略类型
 * 调用 UpgradeLink SDK 查询策略（轻量级）
 */
async function fetchUpgradeType(version: string): Promise<UpgradeType> {
  try {
    const currentPlatform = await platform();
    const currentArch = await arch();

    // 构建 UpgradeLink 查询 URL
    const url = new URL("https://api.upgrade.toolsetlink.com/v1/tauri/upgrade");
    url.searchParams.set("tauriKey", UPGRADELINK_KEYS.tauriKey);
    url.searchParams.set("versionName", version);
    url.searchParams.set("target", currentPlatform);
    url.searchParams.set("arch", currentArch);

    const response = await fetch(url.toString());

    if (!response.ok) {
      return "prompt"; // 默认提示升级
    }

    const data = await response.json();
    
    // 解析 upgradeType
    // 0: 不升级, 1: 提示升级, 2: 强制升级, 3: 静默升级
    switch (data.upgradeType) {
      case 2:
        return "force";
      case 3:
        return "silent";
      case 1:
      default:
        return "prompt";
    }
  } catch (error) {
    console.warn("[upgrade] Failed to fetch upgrade type:", error);
    return "prompt"; // 失败时默认提示升级
  }
}

/**
 * 执行更新（桌面端）
 */
export async function executeDesktopUpdate(
  update: Update,
  onProgress?: (downloaded: number, total: number) => void,
): Promise<void> {
  let downloadedBytes = 0;
  let totalBytes = 0;

  await update.downloadAndInstall((event) => {
    if (!onProgress) return;

    switch (event.event) {
      case 'Started':
        totalBytes = event.data.contentLength || 0;
        break;
      case 'Progress':
        downloadedBytes += event.data.chunkLength;
        onProgress(downloadedBytes, totalBytes);
        break;
      case 'Finished':
        break;
    }
  });
}

/**
 * 检查 Android 更新
 * Android 使用 UpgradeLink SDK + AppUpdater
 */
export async function checkAndroidUpdate(
  currentVersionCode: number,
  deviceId?: string,
): Promise<{
  hasUpdate: boolean;
  versionName: string | null;
  versionCode: number;
  upgradeType: UpgradeType;
  downloadUrl: string | null;
  promptContent: string | null;
}> {
  try {
    // 动态导入 SDK（只在 Android 使用）
    const { default: Client, Config, ApkUpgradeRequest } = await import(
      "@toolsetlink/upgradelink-api-typescript"
    );

    const config = new Config({
      accessKey: import.meta.env.VITE_UPGRADE_LINK_ACCESS_KEY || "",
      accessSecret: import.meta.env.VITE_UPGRADE_LINK_ACCESS_SECRET || "",
    });
    const client = new Client(config);

    const request = new ApkUpgradeRequest({
      apkKey: UPGRADELINK_KEYS.apkKey,
      versionCode: currentVersionCode,
      appointVersionCode: 0,
      devModelKey: "",
      devKey: deviceId || "",
    });

    const response = await client.ApkUpgrade(request);

    if (response.code !== 200 || !response.data) {
      return {
        hasUpdate: false,
        versionName: null,
        versionCode: 0,
        upgradeType: null,
        downloadUrl: null,
        promptContent: null,
      };
    }

    // 映射 upgradeType
    let upgradeType: UpgradeType = "prompt";
    switch (response.data.upgradeType) {
      case 2:
        upgradeType = "force";
        break;
      case 3:
        upgradeType = "silent";
        break;
      case 1:
      default:
        upgradeType = "prompt";
    }

    return {
      hasUpdate: true,
      versionName: response.data.versionName || null,
      versionCode: response.data.versionCode || 0,
      upgradeType,
      downloadUrl: response.data.urlPath || null,
      promptContent: response.data.promptUpgradeContent || null,
    };
  } catch (error) {
    console.error("[upgrade] Failed to check Android update:", error);
    return {
      hasUpdate: false,
      versionName: null,
      versionCode: 0,
      upgradeType: null,
      downloadUrl: null,
      promptContent: null,
    };
  }
}

/**
 * 语义化版本转数字版本码
 */
export function semverToVersionCode(version: string): number {
  const parts = version.replace(/^v/, "").split(".");
  const major = parseInt(parts[0] || "0", 10);
  const minor = parseInt(parts[1] || "0", 10);
  const patch = parseInt(parts[2] || "0", 10);
  return major * 10000 + minor * 100 + patch;
}

/**
 * 数字版本码转语义化版本
 */
export function versionCodeToSemver(versionCode: number): string {
  const major = Math.floor(versionCode / 10000);
  const minor = Math.floor((versionCode % 10000) / 100);
  const patch = versionCode % 100;
  return `${major}.${minor}.${patch}`;
}
