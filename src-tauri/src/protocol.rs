//! 应用层协议类型
//!
//! 定义 libp2p Request-Response 协议的请求/响应类型。
//! CBOR 编解码由 `swarm-p2p-core` 自动完成。

use serde::{Deserialize, Serialize};
use swarm_p2p_core::NetClient;

use crate::device::OsInfo;

// ============ Pairing 协议 ============

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

// ============ Transfer 协议 ============

/// 传输文件元信息（Offer 中携带）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    /// 文件标识符（递增分配）
    pub file_id: u32,
    /// 文件名
    pub name: String,
    /// 相对路径（用于在接收方重建目录结构）
    pub relative_path: String,
    /// 文件大小（字节）
    pub size: u64,
    /// BLAKE3 校验和（hex 编码）
    pub checksum: String,
}

/// 传输请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum TransferRequest {
    /// 发送方向接收方提出文件传输请求
    Offer {
        session_id: String,
        files: Vec<FileInfo>,
        total_size: u64,
    },
    // Phase 3 后续扩展：
    // ChunkRequest { session_id: String, file_id: u32, chunk_index: u32 },
    // Complete { session_id: String },
    // Cancel { session_id: String, reason: String },
}

/// 传输响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum TransferResponse {
    /// 接收方回复 Offer 请求
    OfferResult {
        accepted: bool,
        /// 接受时由接收方生成的 256-bit 对称加密密钥
        #[serde(
            serialize_with = "serialize_opt_key",
            deserialize_with = "deserialize_opt_key"
        )]
        key: Option<[u8; 32]>,
        /// 拒绝时的原因
        reason: Option<String>,
    },
    // Phase 3 后续扩展：
    // Chunk { session_id: String, file_id: u32, chunk_index: u32, data: Vec<u8> },
    // Ack { session_id: String },
}

/// 将 `Option<[u8; 32]>` 序列化为 bytes array（CBOR 友好）
fn serialize_opt_key<S: serde::Serializer>(
    key: &Option<[u8; 32]>,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    match key {
        Some(k) => serializer.serialize_some(&k[..]),
        None => serializer.serialize_none(),
    }
}

/// 从 bytes 反序列化 `Option<[u8; 32]>`
fn deserialize_opt_key<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<[u8; 32]>, D::Error> {
    let opt: Option<Vec<u8>> = Option::deserialize(deserializer)?;
    match opt {
        None => Ok(None),
        Some(v) => {
            let arr: [u8; 32] = v
                .try_into()
                .map_err(|_| serde::de::Error::custom("expected 32 bytes for key"))?;
            Ok(Some(arr))
        }
    }
}

// ============ 顶层协议枚举 ============

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum AppRequest {
    Pairing(PairingRequest),
    Transfer(TransferRequest),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum AppResponse {
    Pairing(PairingResponse),
    Transfer(TransferResponse),
}

pub type AppNetClient = NetClient<AppRequest, AppResponse>;
