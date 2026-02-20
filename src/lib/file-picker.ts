/**
 * file-picker
 * 封装跨平台文件系统操作
 * Android 平台使用 tauri-plugin-android-fs-api
 * 其他平台使用标准 Tauri dialog / opener
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

/**
 * 打开文件夹（在系统文件管理器中显示）
 * Android：openPath 不支持，使用 openUrl 兜底
 * 桌面端：使用 opener 插件
 */
export async function openFolder(path: string): Promise<void> {
  if (isAndroid()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(`file://${path}`);
    return;
  }

  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(path);
}

/**
 * 在文件管理器中显示并选中文件
 * 仅桌面端支持，移动端回退到打开所在文件夹
 */
export async function revealFile(filePath: string, folderPath: string): Promise<void> {
  if (isAndroid()) {
    await openFolder(folderPath);
    return;
  }

  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(filePath);
}

/** 文件条目（跨平台统一格式） */
export interface FileEntryInfo {
  path: string;
  name: string;
  size: number;
}

/** listFiles 返回结果 */
export interface ListFilesInfo {
  isDirectory: boolean;
  entries: FileEntryInfo[];
}

/**
 * 将路径字符串转为 AndroidFs 可接受的参数
 * content:// 开头的包装为 AndroidFsUri，其余当作 fs path
 */
function toAndroidPath(path: string): string | { uri: string; documentTopTreeUri: string | null } {
  return path.startsWith("content://")
    ? { uri: path, documentTopTreeUri: null }
    : path;
}

/**
 * 跨平台列举文件
 * Android：使用 AndroidFs API 获取元信息
 * 桌面端：委托 Rust list_files 命令
 */
export async function listFiles(path: string): Promise<ListFilesInfo> {
  if (!isAndroid()) {
    const { listFiles: rustListFiles } = await import("@/commands/transfer");
    return rustListFiles(path);
  }

  const AndroidFs = await getAndroidFs();
  const arg = toAndroidPath(path);
  const meta = await AndroidFs.getMetadata(arg);

  if (meta.type === "Dir") {
    // readDir 只接受 AndroidFsUri
    const dirUri = typeof arg === "string"
      ? { uri: arg, documentTopTreeUri: null }
      : arg;
    const children = await AndroidFs.readDir(dirUri);
    const entries: FileEntryInfo[] = [];
    for (const child of children) {
      if (child.type === "File") {
        entries.push({
          path: child.uri.uri,
          name: child.name,
          size: child.byteLength,
        });
      }
    }
    return { isDirectory: true, entries };
  }

  return {
    isDirectory: false,
    entries: [{ path, name: meta.name, size: meta.byteLength }],
  };
}

/**
 * 跨平台获取文件元信息
 * Android：使用 AndroidFs.getMetadata
 * 桌面端：委托 Rust get_file_meta 命令
 */
export async function getFileMeta(paths: string[]): Promise<FileEntryInfo[]> {
  if (!isAndroid()) {
    const { getFileMeta: rustGetFileMeta } = await import("@/commands/transfer");
    return rustGetFileMeta(paths);
  }

  const AndroidFs = await getAndroidFs();
  const entries: FileEntryInfo[] = [];
  for (const p of paths) {
    try {
      const arg = toAndroidPath(p);
      const meta = await AndroidFs.getMetadata(arg);
      if (meta.type === "File") {
        entries.push({ path: p, name: meta.name, size: meta.byteLength });
      }
    } catch {
      // 跳过无法访问的路径
    }
  }
  return entries;
}
