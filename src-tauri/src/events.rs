//! Tauri 事件名常量
//!
//! 所有后端 → 前端的事件名集中定义，避免硬编码字符串散落各模块。

// === 网络状态 ===
pub const NETWORK_STATUS_CHANGED: &str = "network-status-changed";
pub const DEVICES_CHANGED: &str = "devices-changed";

// === 配对 ===
pub const PAIRING_REQUEST_RECEIVED: &str = "pairing-request-received";
pub const PAIRED_DEVICE_ADDED: &str = "paired-device-added";

// === 传输 ===
pub const TRANSFER_OFFER: &str = "transfer-offer";
pub const TRANSFER_PROGRESS: &str = "transfer-progress";
pub const TRANSFER_COMPLETE: &str = "transfer-complete";
pub const TRANSFER_FAILED: &str = "transfer-failed";
