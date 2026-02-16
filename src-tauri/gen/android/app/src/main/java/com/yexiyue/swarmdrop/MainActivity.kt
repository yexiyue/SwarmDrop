package com.yexiyue.swarmdrop

import android.os.Bundle
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.enableEdgeToEdge
import com.azhon.appupdate.manager.DownloadManager
import com.azhon.appupdate.config.UpdateConfiguration
import com.azhon.appupdate.listener.OnDownloadListener
import java.io.File

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
    }

    /**
     * 发送 Tauri 事件到前端
     * 使用标准 Tauri Event 系统
     */
    private fun emitTauriEvent(eventName: String, payload: String) {
        runOnUiThread {
            // 通过 WebView 执行 JavaScript 发送 Tauri 事件
            val script = """
                if (window.__TAURI__?.event) {
                    window.__TAURI__.event.emit('$eventName', $payload);
                }
            """.trimIndent()

            // 使用 WryActivity 的 webView 发送事件
            val webView = findViewById<android.webkit.WebView>(android.R.id.content)
                ?.rootView
                ?.findViewById<android.webkit.WebView>(
                    resources.getIdentifier("web_view", "id", packageName)
                )

            webView?.evaluateJavascript(script, null)
        }
    }

    /**
     * 供前端调用：开始 APK 更新
     * 使用 AppUpdater 通知栏展示下载进度
     */
    fun startApkUpdate(url: String, isForce: Boolean = false) {
        runOnUiThread {
            // 检查是否有安装权限
            if (!canInstallApk()) {
                requestInstallPermission()
                return@runOnUiThread
            }

            val configuration = UpdateConfiguration().apply {
                // 是否强制更新
                isForcedUpgrade = isForce
                // 下载完成后自动安装
                isInstallApk = true
                // 显示通知栏进度（默认 true，显式设置）
                isShowNotification = true
                // 显示下载界面（false = 只显示通知栏）
                isShowDownloadUi = false
                // 下载完成后显示通知
                notifyDownloadComplete = true
            }

            DownloadManager.getInstance(this).apply {
                setApkUrl(url)
                setConfiguration(configuration)
                setApkName("swarmdrop-update.apk")
                setSmallIcon(R.mipmap.ic_launcher)
                setDownloadPath(externalCacheDir?.absolutePath + "/Download")

                // 简化的下载监听 - 只处理关键事件
                setOnDownloadListener(object : OnDownloadListener {
                    override fun start() {
                        // 通知栏会自动显示进度，无需额外处理
                    }

                    override fun downloading(max: Int, progress: Int) {
                        // 通知栏自动更新进度，无需额外处理
                    }

                    override fun done(apk: File) {
                        // 下载完成，AppUpdater 自动触发安装
                        // 可以发送事件通知前端更新状态
                        emitTauriEvent("apk-download-done", "{}")
                    }

                    override fun cancel() {
                        emitTauriEvent("apk-download-cancel", "{}")
                    }

                    override fun error(e: Throwable) {
                        val errorMsg = e.message?.replace("\"", "\\\"") ?: "Unknown error"
                        emitTauriEvent("apk-download-error", """{"error":"$errorMsg"}""")

                        // 如果是权限问题，引导用户开启
                        if (!canInstallApk()) {
                            openInstallPermissionSetting()
                        }
                    }
                })

                // 开始下载，通知栏会自动显示进度
                download()
            }
        }
    }

    /**
     * 检查是否可以安装 APK（Android 8.0+ 需要 REQUEST_INSTALL_PACKAGES 权限）
     */
    private fun canInstallApk(): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    /**
     * 请求安装权限
     */
    private fun requestInstallPermission() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:$packageName")
            )
            startActivityForResult(intent, REQUEST_CODE_INSTALL_PERMISSION)
        }
    }

    /**
     * 打开安装权限设置页面
     */
    private fun openInstallPermissionSetting() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CODE_INSTALL_PERMISSION) {
            // 用户从权限设置页面返回，发送事件通知前端
            if (canInstallApk()) {
                emitTauriEvent("apk-install-permission-granted", "{}")
            } else {
                emitTauriEvent("apk-install-permission-denied", "{}")
            }
        }
    }

    companion object {
        private const val REQUEST_CODE_INSTALL_PERMISSION = 1001
    }
}
