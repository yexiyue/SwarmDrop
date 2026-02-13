//! 应用层协议类型
//!
//! 定义 libp2p Request-Response 协议的请求/响应类型。
//! CBOR 编解码由 `swarm-p2p-core` 自动完成。

use serde::{Deserialize, Serialize};
use swarm_p2p_core::NetClient;

use crate::device::OsInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingRequest {
    pub os_info: OsInfo,
    pub timestamp: i64,
    pub method: PairingMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum PairingMethod {
    Code { code: String },
    Direct,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum PairingResponse {
    Success,
    Refused { reason: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum AppRequest {
    Pairing(PairingRequest),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum AppResponse {
    Pairing(PairingResponse),
}

pub type AppNetClient = NetClient<AppRequest, AppResponse>;
