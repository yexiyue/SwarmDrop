use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

pub mod transfer_file;
pub mod transfer_session;

pub use transfer_file::Entity as TransferFile;
pub use transfer_session::Entity as TransferSession;

// ---- 共享类型 ----

/// libp2p PeerId 的数据库存储类型。
/// 以 base58btc 字符串形式持久化，对应 `libp2p::PeerId::to_base58()`。
///
/// 在主 crate 中实现与 `libp2p::PeerId` 之间的相互转换：
/// ```rust,ignore
/// impl From<libp2p::PeerId> for entity::PeerId { ... }
/// impl TryFrom<entity::PeerId> for libp2p::PeerId { ... }
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, DeriveValueType)]
pub struct PeerId(pub String);

impl PeerId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<&str> for PeerId {
    fn from(s: &str) -> Self {
        PeerId(s.to_owned())
    }
}

impl std::fmt::Display for PeerId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// 传输方向
#[derive(
    Clone, Debug, PartialEq, Eq, Serialize, Deserialize, DeriveActiveEnum, strum::EnumIter,
)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::None)", rename_all = "lowercase")]
pub enum TransferDirection {
    Send,
    Receive,
}

/// 传输会话状态
#[derive(
    Clone, Debug, PartialEq, Eq, Serialize, Deserialize, DeriveActiveEnum, strum::EnumIter,
)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::None)", rename_all = "lowercase")]
pub enum SessionStatus {
    Transferring,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

/// 单文件传输状态
#[derive(
    Clone, Debug, PartialEq, Eq, Serialize, Deserialize, DeriveActiveEnum, strum::EnumIter,
)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::None)", rename_all = "lowercase")]
pub enum FileStatus {
    Pending,
    Completed,
    Failed,
}
