/**
 * UpgradeLink SDK Integration
 * 使用 Tauri 官方 updater 配合 UpgradeLink 端点
 */

import { check, type Update } from "@tauri-apps/plugin-updater";
import { fetch } from "@tauri-apps/plugin-http";
import { md5 } from "js-md5";
import dayjs from "dayjs";

// 升级策略类型
export type UpgradeType = "force" | "prompt" | "silent" | null;

// 升级信息接口（仅内部使用）
interface UpdateInfo {
  upgradeType?: UpgradeType;
  rawJson?: {
    upgradeType?: number;
    [key: string]: unknown;
  };
}

// 更新检查结果
interface UpgradeCheckResult {
  hasUpdate: boolean;
  update: UpdateInfo | null;
  version: string | null;
  upgradeType: UpgradeType;
}

// UpgradeLink 应用密钥（从环境变量读取）
const UPGRADELINK_ACCESS_KEY = import.meta.env.VITE_UPGRADE_LINK_ACCESS_KEY ?? "";
const UPGRADELINK_ACCESS_SECRET = import.meta.env.VITE_UPGRADE_LINK_ACCESS_SECRET ?? "";
const UPGRADELINK_APK_KEY = import.meta.env.VITE_UPGRADE_LINK_APK_KEY ?? "";

/**
 * 解析 UpgradeLink 返回的 upgradeType
 * 0: 不升级, 1: 提示升级, 2: 强制升级, 3: 静默升级
 */
function parseUpgradeType(upgradeType: unknown): UpgradeType {
  switch (upgradeType) {
    case 2:
      return "force";
    case 3:
      return "silent";
    case 1:
      return "prompt";
    default:
      return "prompt"; // 默认提示升级
  }
}

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
        'X-AccessKey': UPGRADELINK_ACCESS_KEY,
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

    // 直接从 rawJson 中解析 upgradeType（UpgradeLink 返回的原始数据）
    const upgradeType = parseUpgradeType(update.rawJson?.upgradeType);

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

const UPGRADELINK_ENDPOINT = "https://api.upgrade.toolsetlink.com";

/**
 * 检查 APK 更新
 * 直接调用 UpgradeLink REST API（浏览器兼容，不依赖 Node.js SDK）
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
    const uri = "/v1/apk/upgrade";
    const body = JSON.stringify({
      apkKey: UPGRADELINK_APK_KEY,
      versionCode: currentVersionCode,
      appointVersionCode: 0,
      devModelKey: "",
      devKey: deviceId || "",
    });

    const timestamp = dayjs().format("YYYY-MM-DDTHH:mm:ssZ");
    const nonce = generateNonce();
    const signature = generateSignature(body, nonce, UPGRADELINK_ACCESS_SECRET, timestamp, uri);

    const res = await fetch(`${UPGRADELINK_ENDPOINT}${uri}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-Timestamp": timestamp,
        "x-Nonce": nonce,
        "x-AccessKey": UPGRADELINK_ACCESS_KEY,
        "x-Signature": signature,
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const result = await res.json();

    if (result.code !== 200 || !result.data) {
      return {
        hasUpdate: false,
        versionName: null,
        versionCode: 0,
        upgradeType: null,
        downloadUrl: null,
        promptContent: null,
      };
    }

    const upgradeType = parseUpgradeType(result.data.upgradeType);

    return {
      hasUpdate: true,
      versionName: result.data.versionName || null,
      versionCode: result.data.versionCode || 0,
      upgradeType,
      downloadUrl: result.data.urlPath || null,
      promptContent: result.data.promptUpgradeContent || null,
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


/** 生成 16 位随机 hex nonce */
function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** UpgradeLink 签名：MD5(body={body}&nonce={nonce}&secretKey={secret}&timestamp={ts}&url={uri}) */
function generateSignature(
  body: string,
  nonce: string,
  secretKey: string,
  timestamp: string,
  uri: string,
): string {
  const parts: string[] = [];
  if (body !== "") parts.push(`body=${body}`);
  parts.push(`nonce=${nonce}`, `secretKey=${secretKey}`, `timestamp=${timestamp}`, `url=${uri}`);
  return md5(parts.join("&"));
}

/**
 * 语义化版本转数字版本码
 */
export function semverToVersionCode(version: string): number {
  const parts = version.replace(/^v/, "").split(".");
  const major = parseInt(parts[0] || "0", 10);
  const minor = parseInt(parts[1] || "0", 10);
  const patch = parseInt(parts[2] || "0", 10);
  return major * 10000 + minor * 1000 + patch;
}

/**
 * 数字版本码转语义化版本
 */
export function versionCodeToSemver(versionCode: number): string {
  const major = Math.floor(versionCode / 10000);
  const minor = Math.floor((versionCode % 10000) / 1000);
  const patch = versionCode % 1000;
  return `${major}.${minor}.${patch}`;
}
