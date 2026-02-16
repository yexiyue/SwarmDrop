//! Android 移动端插件桥接
//!
//! 这个模块注册 Kotlin 插件到 Tauri 运行时
//! 实际业务逻辑在 UpdaterPlugin.kt 中实现

use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.yexiyue.swarmdrop";

/// 初始化 Android 更新插件
pub fn init_updater<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::AppResult<UpdaterPlugin<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "UpdaterPlugin")?;

    #[cfg(not(target_os = "android"))]
    let handle = {
        let _ = (api,);
        // 非 Android 平台返回空句柄（实际不会被调用）
        return Err(crate::AppError::Io(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "Android plugin only supported on Android",
        )));
    };

    Ok(UpdaterPlugin(handle))
}

/// Android 更新插件句柄
pub struct UpdaterPlugin<R: Runtime>(PluginHandle<R>);

// 如果以后需要从 Rust 调用，可以添加方法
#[allow(dead_code)]
impl<R: Runtime> UpdaterPlugin<R> {
    pub fn install_update(&self, url: String, is_force: bool) -> crate::AppResult<()> {
        #[derive(serde::Serialize)]
        struct Payload {
            url: String,
            #[serde(rename = "isForce")]
            is_force: bool,
        }

        self.0
            .run_mobile_plugin("installUpdate", Payload { url, is_force })
            .map_err(Into::into)
    }
}
