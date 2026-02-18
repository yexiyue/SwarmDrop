/**
 * Transfer commands
 * 文件传输相关类型定义和命令（stub，后端未实现）
 */

import { invoke } from "@tauri-apps/api/core";

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

// === 命令函数（stub） ===

/**
 * 准备发送：扫描文件、计算校验和
 * TODO: 后端实现后替换
 */
export async function prepareSend(
  filePaths: string[],
): Promise<PreparedTransfer> {
  return invoke("prepare_send", { filePaths });
}

/**
 * 开始发送到指定设备
 * 返回 session_id
 */
export async function startSend(
  preparedId: string,
  peerId: string,
  selectedFileIds: number[],
): Promise<string> {
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
