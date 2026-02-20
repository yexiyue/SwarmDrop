/**
 * useAndroidFs
 * 封装跨平台文件系统操作
 * Android 平台使用 tauri-plugin-android-fs-api
 * 其他平台使用标准 Tauri dialog
 */

import { open } from "@tauri-apps/plugin-dialog";
import { type } from "@tauri-apps/plugin-os";

// 动态导入 Android FS API（仅在 Android 平台）
async function getAndroidFs() {
  const { AndroidFs } = await import("tauri-plugin-android-fs-api");
  return AndroidFs;
}

/**
 * 将 FsPath 转换为字符串
 */
function fsPathToString(path: string | URL): string {
  return typeof path === "string" ? path : path.href;
}

/**
 * 检测是否为 Android 平台
 */
export function isAndroid(): boolean {
  return type() === "android";
}

/**
 * 选择文件
 * @param multiple 是否允许多选
 */
export async function pickFiles(multiple = true): Promise<string[]> {
  if (isAndroid()) {
    const AndroidFs = await getAndroidFs();
    const uris = await AndroidFs.showOpenFilePicker({
      mimeTypes: ["*/*"],
      multiple,
    });
    if (uris.length === 0) return [];

    const paths: string[] = [];
    for (const uri of uris) {
      try {
        const fsPath = await AndroidFs.getFsPath(uri);
        paths.push(fsPathToString(fsPath));
      } catch {
        paths.push(uri.uri);
      }
    }
    return paths;
  }

  const selected = await open({ multiple });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

/**
 * 选择文件夹
 * Android：检查存储权限后使用原生目录选择器
 * 桌面端：使用标准 Tauri dialog
 * @param defaultPath 默认路径（仅桌面端生效）
 */
export async function pickFolder(
  defaultPath?: string,
): Promise<string | null> {
  if (isAndroid()) {
    const AndroidFs = await getAndroidFs();
    const hasPermission = await AndroidFs.hasPublicFilesPermission();
    if (!hasPermission) {
      const granted = await AndroidFs.requestPublicFilesPermission();
      if (!granted) return null;
    }
    const uri = await AndroidFs.showOpenDirPicker({});
    if (!uri) return null;

    try {
      const fsPath = await AndroidFs.getFsPath(uri);
      return fsPathToString(fsPath);
    } catch {
      return uri.uri;
    }
  }

  return await open({ directory: true, defaultPath });
}
