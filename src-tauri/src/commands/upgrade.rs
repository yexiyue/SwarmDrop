/**
 * Upgrade Commands
 * 处理应用更新相关的命令
 */

use tauri::{AppHandle, command, Runtime};

/// Android 安装 APK 命令
/// 前端调用此命令触发 Android 原生安装流程
#[command]
pub async fn install_android_update<R: Runtime>(
    _app: AppHandle<R>,
    url: String,
) -> Result<(), String> {
    // Android 平台：通过 Tauri Bridge 调用 Kotlin 代码
    // 实际实现在 MainActivity.kt 中
    // 这里只需要定义命令接口，Tauri 会自动桥接

    #[cfg(target_os = "android")]
    {
        // Android 实现由前端直接调用，或通过 JNI 桥接
        // 详见 MainActivity.kt 中的 startApkUpdate 方法
        let _ = url;
        Ok(())
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = url;
        Err("This command is only available on Android".to_string())
    }
}
