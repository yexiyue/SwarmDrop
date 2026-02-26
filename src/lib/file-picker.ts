/**
 * file-picker
 * 封装跨平台文件系统操作
 * Android 平台使用 tauri-plugin-android-fs-api
 * 其他平台使用标准 Tauri dialog / opener
 */

import { open } from "@tauri-apps/plugin-dialog";
import { type } from "@tauri-apps/plugin-os";
import { downloadDir, join } from "@tauri-apps/api/path";
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
 * Android：应用私有目录无法被外部文件管理器访问，跳过
 * 桌面端：使用 opener 插件
 */
export async function openFolder(path: string): Promise<void> {
  if (isAndroid()) return;

  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(path);
}

/** 根据文件扩展名猜测 MIME 类型 */
function guessMimeType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp",
    mp4: "video/mp4", mkv: "video/x-matroska", avi: "video/x-msvideo", mov: "video/quicktime",
    mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", ogg: "audio/ogg",
    pdf: "application/pdf", zip: "application/zip", apk: "application/vnd.android.package-archive",
    txt: "text/plain", html: "text/html", json: "application/json",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return (ext && map[ext]) || "application/octet-stream";
}

/**
 * 用系统默认应用打开文件
 * Android：复制到公共 Download 目录后通过 showViewFileDialog 打开
 *          （showViewFileDialog 只接受 content:// URI，不支持 file://）
 * 桌面端：使用 opener 插件
 */
export async function openFile(path: string): Promise<void> {
  if (isAndroid()) {
    const [AndroidFs, { AndroidPublicGeneralPurposeDir }] = await Promise.all([
      getAndroidFs(),
      import("tauri-plugin-android-fs-api"),
    ]);

    const name = path.split("/").pop() || "file";
    const mimeType = guessMimeType(name);

    // 在公共 Download 目录创建文件并复制内容
    const destUri = await AndroidFs.createNewPublicFile(
      AndroidPublicGeneralPurposeDir.Download,
      `SwarmDrop/${name}`,
      mimeType,
    );
    await AndroidFs.copyFile(path, destUri);
    await AndroidFs.showViewFileDialog(destUri);
    return;
  }

  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(path);
}

/**
 * 在文件管理器中显示并选中文件
 * Android：直接打开文件（无法定位到文件管理器）
 * 桌面端：在文件管理器中高亮显示
 */
export async function revealFile(filePath: string, _folderPath: string): Promise<void> {
  if (isAndroid()) {
    await openFile(filePath);
    return;
  }

  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(filePath);
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
