/**
 * useAndroidFs
 * 封装 Android 文件系统操作
 * 在 Android 平台使用 tauri-plugin-android-fs-api
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
 * @returns 选中的文件路径数组
 */
export async function pickFiles(multiple = true): Promise<string[]> {
  if (isAndroid()) {
    try {
      const AndroidFs = await getAndroidFs();
      const uris = await AndroidFs.showOpenFilePicker({
        mimeTypes: ["*/*"],
        multiple,
      });
      if (uris.length === 0) return [];

      // 将 URI 转换为路径
      const paths: string[] = [];
      for (const uri of uris) {
        try {
          const fsPath = await AndroidFs.getFsPath(uri);
          paths.push(fsPathToString(fsPath));
        } catch {
          // 如果转换失败，使用 URI 的字符串表示
          paths.push(uri.uri);
        }
      }
      return paths;
    } catch (err) {
      console.error("Failed to pick files on Android:", err);
      return [];
    }
  }

  // 桌面端使用 Tauri dialog
  const selected = await open({ multiple });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

/**
 * 选择文件夹
 * @returns 选中的文件夹路径
 */
export async function pickFolder(): Promise<string | null> {
  if (isAndroid()) {
    try {
      const AndroidFs = await getAndroidFs();
      const uri = await AndroidFs.showOpenDirPicker({});
      if (!uri) return null;

      try {
        const fsPath = await AndroidFs.getFsPath(uri);
        return fsPathToString(fsPath);
      } catch {
        return uri.uri;
      }
    } catch (err) {
      console.error("Failed to pick folder on Android:", err);
      return null;
    }
  }

  // 桌面端使用 Tauri dialog
  return await open({ directory: true });
}

/**
 * 选择保存文件夹（带默认路径）
 * @param defaultPath 默认路径（Android 暂不支持）
 * @returns 选中的文件夹路径
 */
export async function pickFolderWithDefault(
  defaultPath?: string,
): Promise<string | null> {
  if (isAndroid()) {
    try {
      const AndroidFs = await getAndroidFs();
      const uri = await AndroidFs.showOpenDirPicker({});
      if (!uri) return null;

      try {
        const fsPath = await AndroidFs.getFsPath(uri);
        return fsPathToString(fsPath);
      } catch {
        return uri.uri;
      }
    } catch (err) {
      console.error("Failed to pick folder on Android:", err);
      return null;
    }
  }

  // 桌面端使用 Tauri dialog
  return await open({ directory: true, defaultPath });
}
