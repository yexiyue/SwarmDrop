/**
 * 桌面端 Updater API 封装
 *
 * 动态导入 @tauri-apps/plugin-updater 和 @tauri-apps/plugin-process，
 * 移动端调用时会 graceful fallback。
 */

import type { Update } from "@tauri-apps/plugin-updater";

/** 检查更新（桌面端），返回 Update 对象或 null */
export async function checkDesktopUpdate(): Promise<Update | null> {
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    return update ?? null;
  } catch (err) {
    console.error("[updater] checkDesktopUpdate failed:", err);
    return null;
  }
}

/** 下载并安装更新（桌面端） */
export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: (downloaded: number, total: number | undefined) => void,
): Promise<void> {
  let downloaded = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        onProgress?.(0, event.data.contentLength);
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress?.(downloaded, undefined);
        break;
      case "Finished":
        break;
    }
  });
}

/** 重启应用 */
export async function relaunchApp(): Promise<void> {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
