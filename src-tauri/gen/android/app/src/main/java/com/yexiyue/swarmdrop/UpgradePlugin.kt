package com.yexiyue.swarmdrop

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke

/**
 * Tauri Plugin for Android APK Update
 * 通过 UpgradeLink + AppUpdater 实现应用更新
 */
@TauriPlugin
class UpgradePlugin(private val activity: Activity) : Plugin(activity) {

    @InvokeArg
    class UpdateArgs {
        lateinit var url: String
        var isForce: Boolean = false
    }

    /**
     * 启动 APK 更新
     * 由 Rust 端通过 run_mobile_plugin() 调用
     */
    @Command
    fun startApkUpdate(invoke: Invoke) {
        val args = invoke.parseArgs(UpdateArgs::class.java)

        // 调用 MainActivity 的更新方法
        (activity as? MainActivity)?.startApkUpdate(args.url, args.isForce)

        // 立即返回成功（实际下载进度通过事件通知）
        invoke.resolve(JSObject())
    }
}
