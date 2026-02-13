//! 设备模块
//!
//! 管理本机 OS 信息、运行时 peer 发现和已配对设备状态。
//! [`DeviceManager`] 维护 peer 列表并提供统一的设备查询接口。

pub mod manager;
mod utils;

pub use manager::{DeviceFilter, DeviceManager};

use serde::{Deserialize, Serialize};
use swarm_p2p_core::libp2p::PeerId;

/// 设备操作系统信息
///
/// 用于本机信息采集、agent_version 编码/解码，
/// 以及作为 [`Device`]、[`PairedDeviceInfo`] 等类型的嵌入字段。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsInfo {
    pub hostname: String,
    pub os: String,
    pub platform: String,
    pub arch: String,
}

impl Default for OsInfo {
    fn default() -> Self {
        Self {
            hostname: tauri_plugin_os::hostname(),
            os: tauri_plugin_os::type_().to_string(),
            platform: tauri_plugin_os::platform().to_string(),
            arch: tauri_plugin_os::arch().to_string(),
        }
    }
}

impl OsInfo {
    pub fn to_agent_version(&self) -> String {
        format!(
            "swarmdrop/{}; os={}; platform={}; arch={}; host={}",
            env!("CARGO_PKG_VERSION"),
            self.os,
            self.platform,
            self.arch,
            self.hostname
        )
    }

    /// 无法解析 agent_version 时的回退值，用 PeerId 前 8 位作为 hostname
    pub fn unknown_from_peer_id(peer_id: &PeerId) -> Self {
        let s = peer_id.to_string();
        Self {
            hostname: s[..8.min(s.len())].to_string(),
            os: "unknown".to_string(),
            platform: "unknown".to_string(),
            arch: "unknown".to_string(),
        }
    }

    /// 从 agent_version 字符串反解析出 OsInfo
    ///
    /// 格式: `swarmdrop/{ver}; os={os}; platform={platform}; arch={arch}; host={hostname}`
    pub fn from_agent_version(agent_version: &str) -> Option<Self> {
        let mut os = None;
        let mut platform = None;
        let mut arch = None;
        let mut hostname = None;

        for part in agent_version.split("; ") {
            if let Some(v) = part.strip_prefix("os=") {
                os = Some(v.to_string());
            } else if let Some(v) = part.strip_prefix("platform=") {
                platform = Some(v.to_string());
            } else if let Some(v) = part.strip_prefix("arch=") {
                arch = Some(v.to_string());
            } else if let Some(v) = part.strip_prefix("host=") {
                hostname = Some(v.to_string());
            }
        }

        Some(Self {
            hostname: hostname?,
            os: os?,
            platform: platform?,
            arch: arch?,
        })
    }
}

/// 已配对设备信息（从前端 Stronghold 注入）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairedDeviceInfo {
    pub peer_id: PeerId,
    #[serde(flatten)]
    pub os_info: OsInfo,
    pub paired_at: i64,
}

/// 设备状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceStatus {
    Online,
    Offline,
}

/// 连接类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionType {
    Lan,
    Dcutr,
    Relay,
}

/// 统一的设备输出类型
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub peer_id: PeerId,
    #[serde(flatten)]
    pub os_info: OsInfo,
    pub status: DeviceStatus,
    pub connection: Option<ConnectionType>,
    pub latency: Option<u64>,
    pub is_paired: bool,
}

/// 设备列表查询结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceListResult {
    pub devices: Vec<Device>,
    pub total: usize,
}
