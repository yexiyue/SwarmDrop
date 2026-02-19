package com.yexiyue.swarmdrop

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.azhon.appupdate.listener.OnDownloadListenerAdapter
import com.azhon.appupdate.manager.DownloadManager
import java.io.File

@InvokeArg
class InstallUpdateArgs {
    lateinit var url: String
    var isForce: Boolean = false
}

@TauriPlugin
class UpdaterPlugin(private val activity: android.app.Activity) : Plugin(activity) {

    override fun load(webView: android.webkit.WebView) {
        // 请求通知权限（Android 13+）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    REQUEST_CODE_NOTIFICATION
                )
            }
        }
    }

    @Command
    fun installUpdate(invoke: Invoke) {
        val args = invoke.parseArgs(InstallUpdateArgs::class.java)

        activity.runOnUiThread {
            if (!canInstallApk()) {
                // 打开安装权限设置页，reject 让前端知道需要重试
                openInstallPermissionSetting()
                trigger("install-permission-required", JSObject())
                invoke.reject("Install permission required. Please grant permission and retry.")
                return@runOnUiThread
            }

            startDownload(args.url, args.isForce)
            invoke.resolve(JSObject().apply { put("success", true) })
        }
    }

    private fun startDownload(url: String, isForce: Boolean) {
        val manager = DownloadManager.Builder(activity).run {
            apkUrl(url)
            apkName("swarmdrop-update.apk")
            smallIcon(R.mipmap.ic_launcher)
            showNotification(true)
            jumpInstallPage(true)
            forcedUpgrade(isForce)
            onDownloadListener(object : OnDownloadListenerAdapter() {
                override fun downloading(max: Int, progress: Int) {
                    trigger("download-progress", JSObject().apply {
                        put("max", max)
                        put("progress", progress)
                    })
                }

                override fun done(apk: File) {
                    trigger("download-done", JSObject())
                }

                override fun cancel() {
                    trigger("download-cancel", JSObject())
                }

                override fun error(e: Throwable) {
                    trigger("download-error", JSObject().apply {
                        put("error", e.message ?: "Unknown error")
                    })
                }
            })
            build()
        }
        manager?.download()
    }

    private fun canInstallApk(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            activity.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    private fun openInstallPermissionSetting() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${activity.packageName}")
            )
            activity.startActivity(intent)
        }
    }

    companion object {
        private const val REQUEST_CODE_NOTIFICATION = 1002
    }
}
