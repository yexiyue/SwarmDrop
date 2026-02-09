use std::time::{Duration, Instant};

use dashmap::DashMap;
use sha2::Digest;

use super::code::{PairingCodeInfo, ShareCodeRecord};
use crate::{
    device::OsInfo,
    protocol::{
        AppNetClient, AppRequest, AppResponse, PairingMethod, PairingRequest, PairingResponse,
    },
    AppError, AppResult,
};
use swarm_p2p_core::libp2p::{kad::Record, PeerId};

pub struct PairingManager {
    client: AppNetClient,
    peer_id: PeerId,
    /// 活跃的配对码，key 为配对码字符串
    active_codes: DashMap<String, PairingCodeInfo>,
}

impl PairingManager {
    pub fn new(client: AppNetClient, peer_id: PeerId) -> Self {
        Self {
            client,
            peer_id,
            active_codes: DashMap::new(),
        }
    }

    pub async fn announce_online(&self) -> AppResult<()> {
        self.client
            .start_provide(self.peer_id.to_bytes().into())
            .await?;
        Ok(())
    }

    pub async fn announce_offline(&self) -> AppResult<()> {
        self.client
            .stop_provide(self.peer_id.to_bytes().into())
            .await?;
        Ok(())
    }

    pub async fn generate_code(&self, expires_in_secs: u64) -> AppResult<PairingCodeInfo> {
        let code_info = PairingCodeInfo::generate(expires_in_secs);

        self.client
            .put_record(Record {
                key: code_info.dht_key().into(),
                value: serde_json::to_vec(&ShareCodeRecord::from(&code_info))?,
                publisher: Some(self.peer_id),
                expires: Some(Instant::now() + Duration::from_secs(expires_in_secs)),
            })
            .await?;

        self.active_codes
            .insert(code_info.code.clone(), code_info.clone());

        Ok(code_info)
    }

    pub async fn get_device_info(&self, code: &str) -> AppResult<(PeerId, ShareCodeRecord)> {
        let record = self
            .client
            .get_record(sha2::Sha256::digest(code.as_bytes()).to_vec().into())
            .await?
            .record;

        if let Some(expires) = record.expires {
            if expires < Instant::now() {
                return Err(AppError::ExpiredCode);
            }
        }

        let peer_id = record.publisher.ok_or(AppError::InvalidCode)?;

        let record = serde_json::from_slice::<ShareCodeRecord>(&record.value)?;

        Ok((peer_id, record))
    }

    pub async fn request_pairing(
        &self,
        peer_id: PeerId,
        method: PairingMethod,
    ) -> AppResult<PairingResponse> {
        let res = self
            .client
            .send_request(
                peer_id,
                AppRequest::Pairing(PairingRequest {
                    os_info: OsInfo::default(),
                    method,
                    timestamp: chrono::Utc::now().timestamp(),
                }),
            )
            .await?;

        match res {
            AppResponse::Pairing(pairing_res) => Ok(pairing_res),
        }
    }

    /// 处理收到的配对请求并发送响应
    ///
    /// - `Code` 模式：验证配对码存在且未过期，验证通过后消耗该配对码
    /// - `Direct` 模式：局域网直连，由用户在 UI 确认授权，无需配对码
    pub async fn handle_pairing_request(
        &self,
        pending_id: u64,
        method: &PairingMethod,
        response: PairingResponse,
    ) -> AppResult<()> {
        if let PairingMethod::Code { code } = method {
            let (_, info) = self
                .active_codes
                .remove(code.as_str())
                .ok_or(AppError::InvalidCode)?;

            if info.is_expired() {
                return Err(AppError::ExpiredCode);
            }
        }

        self.client
            .send_response(pending_id, AppResponse::Pairing(response))
            .await?;

        Ok(())
    }
}
