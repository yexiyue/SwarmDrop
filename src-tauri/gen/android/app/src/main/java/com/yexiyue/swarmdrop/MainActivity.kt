package com.yexiyue.swarmdrop

import android.os.Bundle
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.enableEdgeToEdge
import com.azhon.appupdate.listener.OnDownloadListenerAdapter
import com.azhon.appupdate.manager.DownloadManager
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
            val script = """
                if (window.__TAURI__?.event) {
                    window.__TAURI__.event.emit('$eventName', $payload);
                }
            """.trimIndent()

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

            val manager = DownloadManager.Builder(this).run {
                apkUrl(url)
                apkName("swarmdrop-update.apk")
                smallIcon(R.mipmap.ic_launcher)
                showNotification(true)
                forcedUpgrade(isForce)
                onDownloadListener(object : OnDownloadListenerAdapter() {
                    override fun downloading(max: Int, progress: Int) {
                        // 通知栏自动更新进度，无需额外处理
                    }

                    override fun done(apk: File) {
                        // 下载完成，AppUpdater 自动触发安装
                        emitTauriEvent("apk-download-done", "{}")
                    }

                    override fun cancel() {
                        emitTauriEvent("apk-download-cancel", "{}")
                    }

                    override fun error(e: Throwable) {
                        val errorMsg = e.message?.replace("\"", "\\\"") ?: "Unknown error"
                        emitTauriEvent("apk-download-error", """{"error":"$errorMsg"}""")

                        if (!canInstallApk()) {
                            openInstallPermissionSetting()
                        }
                    }
                })
                build()
            }
            manager?.download()
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
