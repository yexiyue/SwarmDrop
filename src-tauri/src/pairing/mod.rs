//! 配对模块
//!
//! 管理设备配对流程：6 位配对码生成/查询、DHT 记录发布、
//! 配对请求/响应处理。核心逻辑在 [`PairingManager`](manager::PairingManager)。

pub mod code;
pub mod dht_key;
pub mod manager;
