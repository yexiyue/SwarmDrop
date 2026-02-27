/** Tauri 事件名常量（与 Rust 端 src-tauri/src/events.rs 保持一致） */

// === 网络状态 ===
export const NETWORK_STATUS_CHANGED = "network-status-changed";
export const DEVICES_CHANGED = "devices-changed";

// === 配对 ===
export const PAIRING_REQUEST_RECEIVED = "pairing-request-received";
export const PAIRED_DEVICE_ADDED = "paired-device-added";

// === 传输 ===
export const TRANSFER_OFFER = "transfer-offer";
export const TRANSFER_PROGRESS = "transfer-progress";
export const TRANSFER_COMPLETE = "transfer-complete";
export const TRANSFER_FAILED = "transfer-failed";
