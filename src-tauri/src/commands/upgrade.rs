/**
 * Upgrade Commands
 * 处理应用更新相关的命令
 */

use tauri::{AppHandle, command, Runtime};

/// Android 安装 APK 命令
/// 前端调用此命令触发 Android 原生安装流程
#[command]
pub async fn install_android_update<R: Runtime>(
    #[allow(unused_variables)] app: AppHandle<R>,
    #[allow(unused_variables)] url: String,
    #[allow(unused_variables)] is_force: bool,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use jni::signature::JavaType;

        // 使用 Tauri 提供的 Android 上下文访问
        app.run_on_android_context(|env, activity, _webview| {
            // 将 Rust string 转为 Java string
            let url_jstring = env
                .new_string(&url)
                .map_err(|e| format!("Failed to create JString: {}", e))?;

            // 调用 MainActivity.startApkUpdate(String url, boolean isForce)
            let result = env.call_method(
                activity,
                "startApkUpdate",
                "(Ljava/lang/String;Z)V",
                &[
                    (&url_jstring).into(),
                    jni::objects::JValue::Bool(if is_force { 1 } else { 0 }),
                ],
            );

            match result {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("Failed to call startApkUpdate: {}", e)),
            }
        })
        .map_err(|e| e.to_string())?
    }

    #[cfg(not(target_os = "android"))]
    {
        Err("This command is only available on Android".to_string())
    }
}
