use serde::Serialize;
use swarm_p2p_core::{EventReceiver, NodeEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tracing::{info, warn};
use uuid::Uuid;

use super::manager::SharedNetRefs;
use crate::device::DeviceFilter;
use crate::protocol::{AppRequest, AppResponse, PairingRequest, TransferRequest, TransferResponse};
use crate::transfer::progress::TransferFailedEvent;
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
    session_id: Uuid,
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
                NodeEvent::RelayReservationAccepted { .. } => {
                    if let Ok(mut rr) = shared.relay_ready.write() {
                        *rr = true;
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

                        // === 分块传输请求（ChunkRequest / Complete / Cancel） ===
                        AppRequest::Transfer(TransferRequest::ChunkRequest {
                            session_id,
                            file_id,
                            chunk_index,
                        }) => {
                            let session = shared.transfer.get_send_session(&session_id);
                            let client = shared.client.clone();

                            tokio::spawn(async move {
                                let response = match session {
                                    Some(s) => {
                                        match s.handle_chunk_request(file_id, chunk_index).await {
                                            Ok(resp) => AppResponse::Transfer(resp),
                                            Err(e) => {
                                                warn!("ChunkRequest 处理失败: {}", e);
                                                AppResponse::Transfer(TransferResponse::Ack {
                                                    session_id,
                                                })
                                            }
                                        }
                                    }
                                    None => {
                                        warn!("未知的发送会话: {}", session_id);
                                        AppResponse::Transfer(TransferResponse::Ack { session_id })
                                    }
                                };
                                if let Err(e) = client.send_response(pending_id, response).await {
                                    warn!("发送 Chunk 响应失败: {}", e);
                                }
                            });
                        }

                        AppRequest::Transfer(TransferRequest::Complete { session_id }) => {
                            // 获取统计数据后清理会话
                            let (total_bytes, elapsed_ms) = shared
                                .transfer
                                .get_send_session(&session_id)
                                .map(|s| {
                                    s.handle_complete();
                                    (s.total_bytes_sent(), s.elapsed_ms())
                                })
                                .unwrap_or((0, 0));
                            shared.transfer.remove_send_session(&session_id);

                            let client = shared.client.clone();
                            let app2 = app.clone();
                            tokio::spawn(async move {
                                let response = AppResponse::Transfer(TransferResponse::Ack {
                                    session_id: session_id.clone(),
                                });
                                if let Err(e) = client.send_response(pending_id, response).await {
                                    warn!("发送 Ack 响应失败: {}", e);
                                }

                                // 发送方也发射完成事件
                                let event = crate::transfer::progress::TransferCompleteEvent {
                                    session_id,
                                    direction: "send",
                                    total_bytes,
                                    elapsed_ms,
                                    save_path: None,
                                };
                                let _ = app2.emit("transfer-complete", &event);
                            });
                        }

                        AppRequest::Transfer(TransferRequest::Cancel { session_id, reason }) => {
                            info!(
                                "收到对方取消传输: session={}, reason={}",
                                session_id, reason
                            );

                            // 检查是否有发送会话
                            if let Some(s) = shared.transfer.get_send_session(&session_id) {
                                s.handle_cancel();
                                shared.transfer.remove_send_session(&session_id);
                            }

                            // 检查是否有接收会话
                            if let Some(s) = shared.transfer.get_receive_session(&session_id) {
                                s.cancel();
                                shared.transfer.remove_receive_session(&session_id);
                                // 在 spawn 中异步清理 .part 文件
                                tokio::spawn(async move {
                                    s.cleanup_part_files().await;
                                });
                            }

                            // 回复 Ack
                            let client = shared.client.clone();
                            let session_id_clone = session_id.clone();
                            tokio::spawn(async move {
                                let response = AppResponse::Transfer(TransferResponse::Ack {
                                    session_id: session_id_clone,
                                });
                                let _ = client.send_response(pending_id, response).await;
                            });

                            // 发射失败事件
                            let event = TransferFailedEvent {
                                session_id,
                                direction: "unknown",
                                error: format!("对方取消: {}", reason),
                            };
                            let _ = app.emit("transfer-failed", &event);
                        }

                        AppRequest::Transfer(TransferRequest::Offer {
                            session_id,
                            files,
                            total_size,
                        }) => {
                            // 仅接受已配对设备的 Offer
                            if !shared.pairing.is_paired(&peer_id) {
                                warn!("Rejecting transfer offer from unpaired peer: {}", peer_id);
                                let response =
                                    AppResponse::Transfer(TransferResponse::OfferResult {
                                        accepted: false,
                                        key: None,
                                        reason: Some("未配对设备".into()),
                                    });
                                let client = shared.client.clone();
                                tokio::spawn(async move {
                                    if let Err(e) = client.send_response(pending_id, response).await
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
                            shared.transfer.cache_inbound_offer(
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
