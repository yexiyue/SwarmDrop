package com.yexiyue.swarmdrop

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.azhon.appupdate.config.UpdateConfiguration
import com.azhon.appupdate.listener.OnDownloadListener
import com.azhon.appupdate.manager.DownloadManager
import java.io.File

class MainActivity : TauriActivity() {
  companion object {
    const val REQUEST_CODE_INSTALL_PERMISSION = 1001
    const val REQUEST_CODE_NOTIFICATION_PERMISSION = 1002
  }

  // 待执行的更新 URL（权限申请后使用）
  private var pendingUpdateUrl: String? = null
  private var pendingIsForce: Boolean = false

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  /**
   * 启动 APK 更新（供 Rust/JS 调用）
   */
  fun startApkUpdate(url: String, isForce: Boolean = false) {
    // Android 13+ 需要通知权限
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
        != PackageManager.PERMISSION_GRANTED
      ) {
        pendingUpdateUrl = url
        pendingIsForce = isForce
        ActivityCompat.requestPermissions(
          this,
          arrayOf(Manifest.permission.POST_NOTIFICATIONS),
          REQUEST_CODE_NOTIFICATION_PERMISSION
        )
        return
      }
    }

    // 检查安装权限
    if (!canInstallApk()) {
      pendingUpdateUrl = url
      pendingIsForce = isForce
      requestInstallPermission()
      return
    }

    doStartUpdate(url, isForce)
  }

  /**
   * 执行实际更新
   */
  private fun doStartUpdate(url: String, isForce: Boolean) {
    val configuration = UpdateConfiguration().apply {
      isShowNotification = true      // 系统通知栏显示进度
      isShowBgdToast = false         // 不显示后台下载提示
      isShowDownloadDialog = isForce // 强制更新时显示对话框
      isInstallApk = true            // 自动安装
      isDownloadOnWifi = false       // 不限于 WiFi
    }

    DownloadManager.getInstance(this).apply {
      setApkUrl(url)
      setConfiguration(configuration)
      setOnDownloadListener(object : OnDownloadListener {
        override fun downloading(max: Int, progress: Int) {
          emitTauriEvent("apk-download-progress", """{"max":$max,"progress":$progress}""")
        }

        override fun done(apk: File) {
          emitTauriEvent("apk-download-done", "{}")
          // 自动安装
          installApk(apk)
        }

        override fun error(e: Throwable) {
          emitTauriEvent("apk-download-error", """{"error":"${e.message}"}""")
        }

        override fun cancel() {
          emitTauriEvent("apk-download-cancel", "{}")
        }
      })
      download()
    }
  }

  /**
   * 安装 APK
   */
  private fun installApk(apkFile: File) {
    val intent = Intent(Intent.ACTION_VIEW).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

      val apkUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        FileProvider.getUriForFile(
          this@MainActivity,
          "${packageName}.fileprovider",
          apkFile
        )
      } else {
        Uri.fromFile(apkFile)
      }

      setDataAndType(apkUri, "application/vnd.android.package-archive")
    }

    startActivity(intent)
  }

  /**
   * 检查是否可以安装 APK
   */
  private fun canInstallApk(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      packageManager.canRequestPackageInstalls()
    } else {
      true
    }
  }

  /**
   * 请求安装权限
   */
  private fun requestInstallPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
        data = Uri.parse("package:$packageName")
      }
      startActivityForResult(intent, REQUEST_CODE_INSTALL_PERMISSION)
    }
  }

  /**
   * 发送事件到 Tauri（前端）
   */
  private fun emitTauriEvent(eventName: String, payload: String) {
    // 通过 Tauri 的 event 系统发送
    // 需要在 Rust 侧监听并转发到前端
    val bridge = this@MainActivity
    bridge.javaClass.getMethod("emit", String::class.java, String::class.java)
      ?.invoke(bridge, eventName, payload)
  }

  /**
   * 权限请求回调
   */
  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)

    when (requestCode) {
      REQUEST_CODE_NOTIFICATION_PERMISSION -> {
        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
          pendingUpdateUrl?.let { url ->
            doStartUpdate(url, pendingIsForce)
            pendingUpdateUrl = null
          }
        }
      }
    }
  }

  /**
   * Activity 结果回调（权限申请等）
   */
  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)

    when (requestCode) {
      REQUEST_CODE_INSTALL_PERMISSION -> {
        if (canInstallApk()) {
          emitTauriEvent("apk-install-permission-granted", "{}")
          pendingUpdateUrl?.let { url ->
            doStartUpdate(url, pendingIsForce)
            pendingUpdateUrl = null
          }
        }
      }
    }
  }
}
