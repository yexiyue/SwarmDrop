/**
 * Transfer commands
 * 文件传输相关类型定义和命令
 */

import { Channel, invoke } from "@tauri-apps/api/core";
import { AndroidFsUri } from "tauri-plugin-android-fs-api";

// === 类型定义 ===

/** 传输方向 */
export type TransferDirection = "send" | "receive";

/** 传输状态 */
export type TransferStatus =
  | "pending"
  | "waiting_accept"
  | "transferring"
  | "completed"
  | "failed"
  | "cancelled";

/** 文件信息 */
export interface TransferFileInfo {
  fileId: number;
  name: string;
  relativePath: string;
  size: number;
  isDirectory: boolean;
}

/** 准备发送的结果 */
export interface PreparedTransfer {
  preparedId: string;
  files: TransferFileInfo[];
  totalSize: number;
}

/** 传输会话 */
export interface TransferSession {
  sessionId: string;
  direction: TransferDirection;
  peerId: string;
  deviceName: string;
  files: TransferFileInfo[];
  totalSize: number;
  status: TransferStatus;
  progress: TransferProgressEvent | null;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
  savePath?: string;
}

// === 事件类型 ===

/** 接收方收到传输提议 */
export interface TransferOfferEvent {
  sessionId: string;
  peerId: string;
  deviceName: string;
  files: TransferFileInfo[];
  totalSize: number;
}

/** 传输进度更新 */
export interface TransferProgressEvent {
  sessionId: string;
  direction: TransferDirection;
  totalFiles: number;
  completedFiles: number;
  currentFile: {
    fileId: number;
    name: string;
    size: number;
    transferred: number;
    chunksCompleted: number;
    totalChunks: number;
  } | null;
  totalBytes: number;
  transferredBytes: number;
  speed: number;
  eta: number | null;
}

/** 传输完成 */
export interface TransferCompleteEvent {
  sessionId: string;
  direction: TransferDirection;
  totalBytes: number;
  elapsedMs: number;
  savePath?: string;
}

/** 传输失败 */
export interface TransferFailedEvent {
  sessionId: string;
  direction: TransferDirection;
  error: string;
}

// === 文件来源 ===

/**
 * 文件来源（与 Rust FileSource 枚举对应）
 * - path: 标准文件系统路径（桌面 + Android 私有目录）
 * - androidUri: Android SAF/MediaStore URI（复用 tauri-plugin-android-fs-api 的 AndroidFsUri）
 */
export type FileSource =
  | { type: "path"; path: string }
  | ({ type: "androidUri" } & AndroidFsUri);

// === 扫描结果 ===

/** 单个来源的扫描结果 */
export interface ScannedSourceResult {
  isDirectory: boolean;
  files: ScannedFile[];
  totalSize: number;
}

/** 扫描到的单个文件（同时用于 scanSources 返回和 prepareSend 输入） */
export interface ScannedFile {
  source: FileSource;
  name: string;
  relativePath: string;
  size: number;
}

/** prepare_send 进度事件 */
export interface PrepareProgress {
  /** 当前正在 hash 的文件名 */
  currentFile: string;
  /** 已完成 hash 的文件数 */
  completedFiles: number;
  /** 总文件数 */
  totalFiles: number;
  /** 累积已 hash 的字节数（所有文件） */
  bytesHashed: number;
  /** 总字节数（所有文件） */
  totalBytes: number;
}

// === 命令函数 ===

/** 开始发送的结果 */
export interface StartSendResult {
  sessionId: string;
  accepted: boolean;
  reason: string | null;
}

/**
 * 扫描文件来源：遍历目录、收集元数据，不计算 hash
 * 用于用户选择文件后在 UI 上展示文件树
 */
export async function scanSources(
  sources: FileSource[],
): Promise<ScannedSourceResult[]> {
  return invoke("scan_sources", { sources });
}

/**
 * 准备发送：对预扫描的文件列表计算 BLAKE3 校验和
 * 接收 scanSources 返回的 ScannedFile 列表（前端可能已移除部分文件）
 * @param onProgress 可选的进度回调，实时接收 hash 计算进度
 */
export async function prepareSend(
  files: ScannedFile[],
  onProgress?: (progress: PrepareProgress) => void,
): Promise<PreparedTransfer> {
  const channel = new Channel<PrepareProgress>();
  if (onProgress) {
    channel.onmessage = onProgress;
  }
  return invoke("prepare_send", { files, onProgress: channel });
}

/** 开始发送到指定设备，等待对方响应 */
export async function startSend(
  preparedId: string,
  peerId: string,
  selectedFileIds: number[],
): Promise<StartSendResult> {
  return invoke("start_send", { preparedId, peerId, selectedFileIds });
}

/** 取消发送 */
export async function cancelSend(sessionId: string): Promise<void> {
  return invoke("cancel_send", { sessionId });
}

/** 确认接收 */
export async function acceptReceive(
  sessionId: string,
  savePath: string,
): Promise<void> {
  return invoke("accept_receive", { sessionId, savePath });
}

/** 拒绝接收 */
export async function rejectReceive(sessionId: string): Promise<void> {
  return invoke("reject_receive", { sessionId });
}

/** 取消接收 */
export async function cancelReceive(sessionId: string): Promise<void> {
  return invoke("cancel_receive", { sessionId });
}
