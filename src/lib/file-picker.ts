/**
 * file-picker
 * 封装跨平台文件系统操作
 * Android 平台使用 tauri-plugin-android-fs-api
 * 其他平台使用标准 Tauri dialog / opener
 */

import { open } from "@tauri-apps/plugin-dialog";
import { type } from "@tauri-apps/plugin-os";
import { downloadDir, join } from "@tauri-apps/api/path";

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

const SAVE_DIR_NAME = "SwarmDrop";

/** 缓存 Android 公共 Download 目录路径（运行时动态发现） */
let androidPublicDownloadDir: string | null = null;

/**
 * 动态发现 Android 公共 Download 目录的实际路径
 * 通过创建临时文件获取 fs path，再提取目录部分
 */
async function resolveAndroidPublicDownloadDir(): Promise<string> {
  if (androidPublicDownloadDir) return androidPublicDownloadDir;

  const [AndroidFs, { AndroidPublicGeneralPurposeDir }] = await Promise.all([
    getAndroidFs(),
    import("tauri-plugin-android-fs-api"),
  ]);

  const tempName = `.swarmdrop_probe_${Date.now()}`;
  const uri = await AndroidFs.createNewPublicFile(
    AndroidPublicGeneralPurposeDir.Download,
    tempName,
    "application/octet-stream",
  );

  try {
    const fsPath = await AndroidFs.getFsPath(uri);
    const pathStr = fsPathToString(fsPath);
    const lastSlash = pathStr.lastIndexOf("/");
    androidPublicDownloadDir = lastSlash > 0 ? pathStr.substring(0, lastSlash) : pathStr;
  } catch {
    // getFsPath 失败时回退到标准路径
    androidPublicDownloadDir = "/storage/emulated/0/Download";
  } finally {
    await AndroidFs.removeFile(uri).catch(() => {});
  }

  return androidPublicDownloadDir;
}

/**
 * 获取默认保存路径
 * Android：公共 Download 目录（外部文件管理器可访问）
 * 桌面端：系统下载目录
 */
export async function getDefaultSavePath(): Promise<string> {
  if (isAndroid()) {
    const dir = await resolveAndroidPublicDownloadDir();
    return `${dir}/${SAVE_DIR_NAME}`;
  }
  const dir = await downloadDir();
  return join(dir, SAVE_DIR_NAME);
}

/**
 * 选择文件
 * @param multiple 是否允许多选
 *
 * Android：选中的文件会被复制到应用缓存目录，
 * 因为 content:// URI 和 getFsPath 返回的路径无法被 Rust std::fs 读取。
 */
export async function pickFiles(multiple = true): Promise<string[]> {
  if (isAndroid()) {
    const AndroidFs = await getAndroidFs();
    const uris = await AndroidFs.showOpenFilePicker({
      mimeTypes: ["*/*"],
      multiple,
    });
    if (uris.length === 0) return [];

    // Android scoped storage 限制：content URI 和 getFsPath 路径
    // 都无法被 Rust std::fs 直接读取，需要复制到应用缓存目录
    const { appCacheDir, join } = await import("@tauri-apps/api/path");
    const cacheBase = await appCacheDir();
    const batchId = Date.now();

    const paths: string[] = [];
    for (let i = 0; i < uris.length; i++) {
      const uri = uris[i];
      const name = await AndroidFs.getName(uri);
      // 用 batchId + index 避免文件名冲突
      const destPath = await join(cacheBase, `send_${batchId}_${i}_${name}`);
      await AndroidFs.copyFile(uri, destPath);
      paths.push(destPath);
    }
    return paths;
  }

  const selected = await open({ multiple });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

/**
 * 选择文件夹
 * Android：使用 SAF 原生目录选择器（无需额外权限）
 * 桌面端：使用标准 Tauri dialog
 * @param defaultPath 默认路径（仅桌面端生效）
 */
export async function pickFolder(
  defaultPath?: string,
): Promise<string | null> {
  if (isAndroid()) {
    const AndroidFs = await getAndroidFs();
    // showOpenDirPicker 使用 SAF，不需要 MANAGE_EXTERNAL_STORAGE 权限
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
 * Android：使用 AndroidFs.showViewDirDialog 打开系统文件管理器
 * 桌面端：使用 opener 插件
 */
export async function openFolder(path: string): Promise<void> {
  if (isAndroid()) {
    try {
      const AndroidFs = await getAndroidFs();
      await AndroidFs.showViewDirDialog({
        uri: `file://${path}`,
        documentTopTreeUri: null,
      });
    } catch {
      // 部分设备不支持 file:// scheme，静默忽略
    }
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
