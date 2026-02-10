use serde::{Deserialize, Serialize};

/// 设备操作系统信息
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
    pub fn new() -> Self {
        Self::default()
    }

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
}
