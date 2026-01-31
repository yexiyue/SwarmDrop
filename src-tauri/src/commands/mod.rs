use swarm_p2p_core::{libp2p::identity::Keypair, NetClient, NodeConfig, NodeEvent};
use tauri::{ipc::Channel, AppHandle, Manager};
use tokio::sync::Mutex;
use tracing::error;

#[tauri::command]
pub async fn start(
    app: AppHandle,
    // keypair: Keypair,
    channel: Channel<NodeEvent>,
) -> crate::AppResult<()> {
    let keypair = Keypair::generate_ed25519();
    let (client, mut receiver) = swarm_p2p_core::start(&keypair, NodeConfig::default())?;

    tokio::spawn(async move {
        while let Some(event) = receiver.recv().await {
            if let Err(e) = channel.send(event) {
                error!("Failed to send event: {}", e);
            }
        }
    });

    if let Some(state) = app.try_state::<Mutex<NetClient>>() {
        *state.lock().await = client;
    } else {
        app.manage(Mutex::new(client));
    }

    Ok(())
}
