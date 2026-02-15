pub mod commands;
pub mod device;
pub mod error;
pub(crate) mod network;
pub(crate) mod pairing;
pub mod protocol;
pub use error::{AppError, AppResult};

use tauri::{AppHandle, Manager, Runtime};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Android 更新插件命令
#[cfg(target_os = "android")]
#[tauri::command]
async fn install_android_update<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    is_force: bool,
) -> Result<(), String> {
    app.run_mobile_plugin::<serde_json::Value>(
        "startApkUpdate",
        serde_json::json!({ "url": url, "isForce": is_force }),
    )
    .await
    .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn install_android_update<R: Runtime>(
    _app: AppHandle<R>,
    _url: String,
    _is_force: bool,
) -> Result<(), String> {
    Err("This command is only available on Android".to_string())
}

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
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // updater 在 setup 中注册，移动端不支持时容错跳过
            if let Err(e) = app
                .handle()
                .plugin(tauri_plugin_updater::Builder::new().build())
            {
                tracing::warn!("Failed to initialize updater plugin: {e}");
            }
            let salt_path = app.path().app_local_data_dir()?.join("salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
            
            // 注册 Android 更新插件
            #[cfg(target_os = "android")]
            {
                app.handle().plugin(
                    tauri::plugin::Builder::new("upgrade")
                        .android_path("com.yexiyue.swarmdrop.UpgradePlugin")
                        .build(),
                )?;
            }
            
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
            commands::list_devices,
            commands::get_network_status,
            install_android_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
