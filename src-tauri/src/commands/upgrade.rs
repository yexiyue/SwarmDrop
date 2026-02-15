/**
 * Upgrade Commands
 * 处理应用更新相关的命令
 */

use tauri::{AppHandle, command, Runtime};

/// Android 安装 APK 命令
/// 前端调用此命令触发 Android 原生安装流程
#[command]
pub async fn install_android_update<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    is_force: bool,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;

        // 获取主窗口
        let window = app
            .get_webview_window("main")
            .ok_or("Main window not found")?;

        // 使用 with_webview 访问 Android 上下文
        window
            .with_webview(move |webview| {
                // 获取 JNI Environment 和 Activity
                let env = webview.jni_env();
                let activity = webview.activity();

                // 将 Rust string 转为 Java string
                let url_jstring = match env.new_string(&url) {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("[upgrade] Failed to create JString: {}", e);
                        return Err(tauri::Error::Unknown(format!("Failed to create JString: {}", e)));
                    }
                };

                // 调用 MainActivity.startApkUpdate(String url, boolean isForce)
                match env.call_method(
                    &activity,
                    "startApkUpdate",
                    "(Ljava/lang/String;Z)V",
                    &[
                        (&url_jstring).into(),
                        jni::objects::JValue::Bool(if is_force { 1 } else { 0 }),
                    ],
                ) {
                    Ok(_) => Ok(()),
                    Err(e) => {
                        eprintln!("[upgrade] Failed to call startApkUpdate: {}", e);
                        Err(tauri::Error::Unknown(format!("Failed to call startApkUpdate: {}", e)))
                    }
                }
            })
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, url, is_force);
        Err("This command is only available on Android".to_string())
    }
}
