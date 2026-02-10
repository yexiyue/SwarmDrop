use swarm_p2p_core::libp2p::identity::Keypair;
use tauri::{AppHandle, Manager};

use crate::AppResult;

/// 生成新的 Ed25519 密钥对
/// 返回 protobuf 编码的字节数组，便于前端存储
#[tauri::command]
pub async fn generate_keypair() -> AppResult<Vec<u8>> {
    let keypair = Keypair::generate_ed25519();
    keypair
        .to_protobuf_encoding()
        .map_err(|e| crate::AppError::Identity(e.to_string()))
}

/// 注册密钥对到 Tauri 状态管理
/// 应用启动时调用，使后端可以访问密钥对
#[tauri::command]
pub async fn register_keypair(app: AppHandle, keypair: Vec<u8>) -> AppResult<String> {
    let keypair = Keypair::from_protobuf_encoding(&keypair)
        .map_err(|e| crate::AppError::Identity(e.to_string()))?;
    let peer_id = keypair.public().to_peer_id();

    // 存入 Tauri 全局状态，后续通过 app.state::<Keypair>() 获取
    app.manage(keypair);

    Ok(peer_id.to_string())
}
