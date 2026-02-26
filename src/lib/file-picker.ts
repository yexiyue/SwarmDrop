/**
 * file-picker
 * 封装跨平台文件系统操作
 * Android 平台使用 tauri-plugin-android-fs-api
 * 其他平台使用标准 Tauri dialog / opener
 */

import { open } from "@tauri-apps/plugin-dialog";
import { type } from "@tauri-apps/plugin-os";
import { downloadDir, join } from "@tauri-apps/api/path";
import type { AndroidFsUri } from "tauri-plugin-android-fs-api";
import type { FileSource } from "@/commands/transfer";

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

/**
 * 获取默认保存路径
 * 所有平台统一使用 downloadDir()，Android 上是应用私有目录，Rust 可直接读写
 */
export async function getDefaultSavePath(): Promise<string> {
  const dir = await downloadDir();
  return join(dir, SAVE_DIR_NAME);
}

/**
 * 选择文件
 * @param multiple 是否允许多选
 * @returns FileSource[] — 文件来源描述，不做文件复制或读取
 *
 * Android：使用 AndroidFs 原生选择器，直接返回 content:// URI（零拷贝）
 * 桌面端：使用标准 Tauri dialog，返回文件路径
 */
export async function pickFiles(multiple = true): Promise<FileSource[]> {
  if (isAndroid()) {
    const { AndroidFs, AndroidPickerInitialLocation, AndroidPublicDir } =
      await import("tauri-plugin-android-fs-api");
    const uris = await AndroidFs.showOpenFilePicker({
      mimeTypes: ["*/*"],
      multiple,
      initialLocation: AndroidPickerInitialLocation.PublicDir(
        AndroidPublicDir.Download,
      ),
    });
    if (uris.length === 0) return [];

    // 直接返回 AndroidFsUri，与 Rust FileUri serde 格式一致
    return uris.map((uri) => ({
      type: "androidUri" as const,
      ...uri,
    }));
  }

  const selected = await open({ multiple });
  if (!selected) return [];
  const paths = Array.isArray(selected) ? selected : [selected];
  return paths.map((p) => ({ type: "path" as const, path: p }));
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
 * Android：使用 showViewDirDialog 打开目录（需要 readable content:// URI）
 * 桌面端：使用 opener 插件（使用文件路径）
 *
 * @param pathOrUri 桌面端传文件夹路径，Android 端传 AndroidFsUri
 * @returns Android 端返回是否成功打开（用于调用方判断是否需要回退）
 */
export async function openFolder(pathOrUri: string | AndroidFsUri): Promise<boolean> {
  if (isAndroid() && typeof pathOrUri !== "string") {
    try {
      const { AndroidFs } = await import("tauri-plugin-android-fs-api");
      await AndroidFs.showViewDirDialog(pathOrUri);
      return true;
    } catch {
      // resolve_initial_location 返回的 URI 仅供 picker 定位，不具备 readable 权限
      // showViewDirDialog 需要 readable URI，对 PublicStorage 目录大概率失败
      return false;
    }
  }

  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(pathOrUri as string);
  return true;
}

/**
 * 用系统默认应用打开文件
 * Android：使用 showViewFileDialog 打开（需要 content:// URI）
 * 桌面端：使用 opener 插件（使用文件路径）
 *
 * @param pathOrUri 桌面端传文件路径，Android 端传 AndroidFsUri
 */
export async function openFile(pathOrUri: string | AndroidFsUri): Promise<void> {
  if (isAndroid() && typeof pathOrUri !== "string") {
    const { AndroidFs } = await import("tauri-plugin-android-fs-api");
    await AndroidFs.showViewFileDialog(pathOrUri);
    return;
  }

  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(pathOrUri as string);
}

/**
 * 在文件管理器中显示并选中文件
 * Android：使用 showViewFileDialog 打开文件
 * 桌面端：在文件管理器中高亮显示
 *
 * @param filePathOrUri 桌面端传文件路径，Android 端传 AndroidFsUri
 */
export async function revealFile(
  filePathOrUri: string | AndroidFsUri,
): Promise<void> {
  if (isAndroid() && typeof filePathOrUri !== "string") {
    await openFile(filePathOrUri);
    return;
  }

  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(filePathOrUri as string);
}

/**
 * 打开传输完成后的文件/文件夹
 * 统一处理 Android/桌面、单文件/多文件的打开逻辑
 *
 * Android 多文件场景：PublicStorage 目录 URI（resolve_initial_location）不具备
 * readable 权限，showViewDirDialog 会失败。回退策略：打开第一个文件 URI。
 */
export async function openTransferResult(session: {
  savePath?: string;
  files: { relativePath: string }[];
  fileUris?: AndroidFsUri[];
  saveDirUri?: AndroidFsUri;
}): Promise<void> {
  if (!session.savePath) return;

  // 单文件：直接打开文件
  if (session.files.length === 1 && session.fileUris?.[0]) {
    await openFile(session.fileUris[0]);
    return;
  }
  if (session.files.length === 1) {
    const filePath = await join(session.savePath, session.files[0].relativePath);
    await revealFile(filePath);
    return;
  }

  // 多文件：尝试打开文件夹
  if (session.saveDirUri) {
    const opened = await openFolder(session.saveDirUri);
    if (opened) return;
    // Android 回退：打开第一个文件 URI
    if (session.fileUris?.[0]) {
      await openFile(session.fileUris[0]);
      return;
    }
  }

  if (session.savePath) {
    await openFolder(session.savePath);
  }
}

/**
 * 选择文件夹（用于发送）
 * @returns FileSource — 文件夹来源描述
 *
 * Android：使用 SAF 目录选择器，返回 content:// URI
 * 桌面端：使用标准 Tauri dialog，返回文件夹路径
 */
export async function pickFolderAsSource(): Promise<FileSource | null> {
  if (isAndroid()) {
    const { AndroidFs, AndroidPickerInitialLocation, AndroidPublicDir } =
      await import("tauri-plugin-android-fs-api");
    const uri = await AndroidFs.showOpenDirPicker({
      initialLocation: AndroidPickerInitialLocation.PublicDir(
        AndroidPublicDir.Download,
      ),
    });
    if (!uri) return null;
    return { type: "androidUri" as const, ...uri };
  }

  const path = await open({ directory: true });
  if (!path) return null;
  return { type: "path" as const, path };
}
