pub mod commands;
pub mod device;
pub mod error;
pub(crate) mod pairing;
pub mod protocol;
pub use error::{AppError, AppResult};

use tauri::Manager;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

fn init_tracing() {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("swarmdrop=debug,swarm_p2p_core=debug")),
        )
        .init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_biometry::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let salt_path = app.path().app_local_data_dir()?.join("salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start,
            commands::shutdown,
            commands::generate_keypair,
            commands::register_keypair,
            commands::generate_pairing_code,
            commands::get_device_info,
            commands::request_pairing,
            commands::respond_pairing_request,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
