use std::time::{Duration, Instant};

use dashmap::DashMap;

use super::code::{OnlineRecord, PairingCodeInfo, ShareCodeRecord};
use super::dht_key;
use crate::{
    device::OsInfo,
    protocol::{
        AppNetClient, AppRequest, AppResponse, PairingMethod, PairingRequest, PairingResponse,
    },
    AppError, AppResult,
};
use swarm_p2p_core::libp2p::{kad::Record, Multiaddr, PeerId};

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

    /// 宣布上线：将本节点的可达地址发布到 DHT
    pub async fn announce_online(&self) -> AppResult<()> {
        let addrs = self.client.get_addrs().await?;
        let record_data = OnlineRecord {
            os_info: OsInfo::default(),
            listen_addrs: addrs,
            timestamp: chrono::Utc::now().timestamp(),
        };
        self.client
            .put_record(Record {
                key: dht_key::online_key(&self.peer_id.to_bytes()),
                value: serde_json::to_vec(&record_data)?,
                publisher: Some(self.peer_id),
                expires: Some(Instant::now() + Duration::from_secs(300)),
            })
            .await?;
        Ok(())
    }

    /// 宣布下线：从 DHT 移除在线记录
    pub async fn announce_offline(&self) -> AppResult<()> {
        self.client
            .remove_record(dht_key::online_key(&self.peer_id.to_bytes()))
            .await?;
        Ok(())
    }

    pub async fn generate_code(&self, expires_in_secs: u64) -> AppResult<PairingCodeInfo> {
        let code_info = PairingCodeInfo::generate(expires_in_secs);

        // 获取当前监听地址，嵌入 DHT Record，供对方 dial 时使用
        let addrs = self.client.get_addrs().await?;
        let mut record_data = ShareCodeRecord::from(&code_info);
        record_data.listen_addrs = addrs;

        self.client
            .put_record(Record {
                key: dht_key::share_code_key(&code_info.code),
                value: serde_json::to_vec(&record_data)?,
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
            .get_record(dht_key::share_code_key(code))
            .await?
            .record;

        if let Some(expires) = record.expires {
            if expires < Instant::now() {
                return Err(AppError::ExpiredCode);
            }
        }

        let peer_id = record.publisher.ok_or(AppError::InvalidCode)?;

        let share_record = serde_json::from_slice::<ShareCodeRecord>(&record.value)?;

        // 将记录中的地址注册到 Swarm 地址簿，确保后续 dial 能找到对方
        if !share_record.listen_addrs.is_empty() {
            self.client
                .add_peer_addrs(peer_id, share_record.listen_addrs.clone())
                .await?;
        }

        Ok((peer_id, share_record))
    }

    pub async fn request_pairing(
        &self,
        peer_id: PeerId,
        method: PairingMethod,
        addrs: Option<Vec<Multiaddr>>,
    ) -> AppResult<PairingResponse> {
        if let Some(addrs) = addrs {
            if !addrs.is_empty() {
                self.client.add_peer_addrs(peer_id, addrs).await?;
            }
        }

        if !self.client.is_connected(peer_id).await? {
            self.client.dial(peer_id).await?;
        }

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
