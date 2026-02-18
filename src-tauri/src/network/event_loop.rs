use serde::Serialize;
use swarm_p2p_core::{EventReceiver, NodeEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tracing::{info, warn};

use super::manager::SharedNetRefs;
use crate::device::DeviceFilter;
use crate::protocol::{AppRequest, AppResponse, PairingRequest, TransferRequest, TransferResponse};
use swarm_p2p_core::libp2p::PeerId;

/// 配对请求事件 payload
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PairingRequestPayload {
    peer_id: PeerId,
    pending_id: u64,
    #[serde(flatten)]
    request: PairingRequest,
}

/// 传输 Offer 事件 payload（推送给前端）
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TransferOfferPayload {
    session_id: String,
    peer_id: String,
    device_name: String,
    files: Vec<TransferFilePayload>,
    total_size: u64,
}

/// Offer 中的文件信息（前端展示用）
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TransferFilePayload {
    file_id: u32,
    name: String,
    relative_path: String,
    size: u64,
    is_directory: bool,
}

/// 当窗口未聚焦时发送系统通知
fn notify_if_unfocused(app: &AppHandle, title: &str, body: &str) {
    let focused = app
        .get_webview_window("main")
        .and_then(|w| w.is_focused().ok())
        .unwrap_or(false);

    if !focused {
        if let Err(e) = app.notification().builder().title(title).body(body).show() {
            warn!("发送通知失败: {}", e);
        }
    }
}

/// 启动事件循环：后端消费所有 NodeEvent，通过 Tauri Event 推送高层域事件 + payload
///
/// 参照 libs/core 的责任链模式——前端不接触原始 NodeEvent。
pub fn spawn_event_loop(
    mut receiver: EventReceiver<AppRequest>,
    app: AppHandle,
    shared: SharedNetRefs,
) {
    tokio::spawn(async move {
        while let Some(event) = receiver.recv().await {
            // handle_event 对不相关的事件直接忽略，无条件调用后再消费 event
            shared.devices.handle_event(&event);

            match event {
                // === 网络状态事件 ===
                NodeEvent::Listening { addr } => {
                    if let Ok(mut addrs) = shared.listen_addrs.write() {
                        addrs.push(addr);
                    }
                    let status = shared.build_network_status();
                    let _ = app.emit("network-status-changed", &status);
                }
                NodeEvent::NatStatusChanged {
                    status,
                    public_addr,
                } => {
                    if let Ok(mut ns) = shared.nat_status.write() {
                        *ns = status;
                    }
                    if let Ok(mut pa) = shared.public_addr.write() {
                        *pa = public_addr;
                    }
                    let net_status = shared.build_network_status();
                    let _ = app.emit("network-status-changed", &net_status);
                }

                // === 设备事件（handle_event 已在上方处理） ===
                NodeEvent::PeersDiscovered { .. }
                | NodeEvent::PeerConnected { .. }
                | NodeEvent::PeerDisconnected { .. }
                | NodeEvent::IdentifyReceived { .. }
                | NodeEvent::PingSuccess { .. }
                | NodeEvent::HolePunchSucceeded { .. } => {
                    let devices = shared.devices.get_devices(DeviceFilter::All);
                    let _ = app.emit("devices-changed", &devices);
                    let net_status = shared.build_network_status();
                    let _ = app.emit("network-status-changed", &net_status);
                }

                // === 入站请求（缓存上下文 + 推送业务事件给前端） ===
                NodeEvent::InboundRequest {
                    peer_id,
                    pending_id,
                    request,
                } => {
                    info!("Inbound request from {:?}: {:?}", peer_id, request);

                    match request {
                        AppRequest::Pairing(req) => {
                            shared
                                .pairing
                                .cache_inbound_request(peer_id, pending_id, &req);
                            notify_if_unfocused(
                                &app,
                                "配对请求",
                                &format!("{} 请求与您配对", req.os_info.hostname),
                            );

                            let payload = PairingRequestPayload {
                                peer_id,
                                pending_id,
                                request: req,
                            };
                            let _ = app.emit("pairing-request-received", &payload);
                        }

                        AppRequest::Transfer(TransferRequest::Offer {
                            session_id,
                            files,
                            total_size,
                        }) => {
                            // 仅接受已配对设备的 Offer
                            if !shared.pairing.is_paired(&peer_id) {
                                warn!(
                                    "Rejecting transfer offer from unpaired peer: {}",
                                    peer_id
                                );
                                let response = AppResponse::Transfer(
                                    TransferResponse::OfferResult {
                                        accepted: false,
                                        key: None,
                                        reason: Some("未配对设备".into()),
                                    },
                                );
                                let client = shared.client.clone();
                                tokio::spawn(async move {
                                    if let Err(e) =
                                        client.send_response(pending_id, response).await
                                    {
                                        warn!("Failed to reject offer: {}", e);
                                    }
                                });
                                continue;
                            }

                            // 获取设备名
                            let device_name = shared
                                .pairing
                                .get_paired_devices()
                                .into_iter()
                                .find(|d| d.peer_id == peer_id)
                                .map(|d| d.os_info.hostname.clone())
                                .unwrap_or_else(|| peer_id.to_string()[..8].to_string());

                            // 缓存入站 Offer
                            shared.offer.cache_inbound_offer(
                                pending_id,
                                peer_id,
                                session_id.clone(),
                                files.clone(),
                                total_size,
                            );

                            // 通知前端
                            let payload = TransferOfferPayload {
                                session_id,
                                peer_id: peer_id.to_string(),
                                device_name: device_name.clone(),
                                files: files
                                    .into_iter()
                                    .map(|f| TransferFilePayload {
                                        file_id: f.file_id,
                                        name: f.name,
                                        relative_path: f.relative_path,
                                        size: f.size,
                                        is_directory: false,
                                    })
                                    .collect(),
                                total_size,
                            };
                            let _ = app.emit("transfer-offer", &payload);

                            notify_if_unfocused(
                                &app,
                                "收到文件传输请求",
                                &format!("{} 想要向您发送文件", device_name),
                            );
                        }
                    }
                }

                // === 信息事件（仅日志，打洞失败仍走 Relay，无需通知用户） ===
                NodeEvent::HolePunchFailed { peer_id, error } => {
                    warn!("Hole punch failed with {}: {}", peer_id, error);
                }
            }
        }
    });
}
