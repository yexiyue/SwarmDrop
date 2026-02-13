//! 应用错误处理模块
//!
//! Tauri 命令的错误必须实现 Serialize 才能传递给前端

use serde::Serialize;
use thiserror::Error;

/// 应用统一错误类型
///
/// 注意：使用 `#[from]` 的变体会存储原始错误类型，
/// 但由于 `std::io::Error` 等不实现 `Serialize`，
/// 我们使用 `#[serde(serialize_with)]` 或转为 String。
#[derive(Debug, Error)]
pub enum AppError {
    /// 文件系统错误
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// 序列化/反序列化错误
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Tauri 错误
    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    /// P2P 核心库错误
    #[error("P2P error: {0}")]
    P2p(#[from] swarm_p2p_core::Error),

    /// Anyhow 错误（用于简化错误处理）
    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),

    /// P2P 网络错误
    #[error("Network error: {0}")]
    Network(String),

    /// 加密相关错误
    #[error("Crypto error: {0}")]
    Crypto(String),

    /// 配置错误
    #[error("Config error: {0}")]
    Config(String),

    /// 文件传输错误
    #[error("Transfer error: {0}")]
    Transfer(String),

    /// 节点未启动
    #[error("Node not started")]
    NodeNotStarted,

    /// 配对码已过期
    #[error("配对码已过期")]
    ExpiredCode,

    /// 无效的配对码
    #[error("无效的配对码")]
    InvalidCode,

    /// 对等节点错误
    #[error("Peer error: {0}")]
    Peer(String),

    /// 身份/密钥对错误
    #[error("Identity error: {0}")]
    Identity(String),

    /// 未知错误
    #[error("{0}")]
    Unknown(String),
}

/// 传递给前端的序列化错误格式
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;

        let mut state = serializer.serialize_struct("AppError", 2)?;

        let (kind, message) = match self {
            AppError::Io(e) => ("Io", e.to_string()),
            AppError::Serialization(e) => ("Serialization", e.to_string()),
            AppError::Tauri(e) => ("Tauri", e.to_string()),
            AppError::P2p(e) => ("P2p", e.to_string()),
            AppError::Anyhow(e) => ("Anyhow", e.to_string()),
            AppError::Network(msg) => ("Network", msg.clone()),
            AppError::Crypto(msg) => ("Crypto", msg.clone()),
            AppError::Config(msg) => ("Config", msg.clone()),
            AppError::Transfer(msg) => ("Transfer", msg.clone()),
            AppError::NodeNotStarted => ("NodeNotStarted", self.to_string()),
            AppError::ExpiredCode => ("ExpiredCode", self.to_string()),
            AppError::InvalidCode => ("InvalidCode", self.to_string()),
            AppError::Peer(msg) => ("Peer", msg.clone()),
            AppError::Identity(msg) => ("Identity", msg.clone()),
            AppError::Unknown(msg) => ("Unknown", msg.clone()),
        };

        state.serialize_field("kind", kind)?;
        state.serialize_field("message", &message)?;
        state.end()
    }
}

// ============ 便捷类型别名 ============

/// Result 类型别名
pub type AppResult<T> = Result<T, AppError>;
