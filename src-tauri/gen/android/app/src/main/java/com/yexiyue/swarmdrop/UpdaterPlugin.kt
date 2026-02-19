package com.yexiyue.swarmdrop

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@InvokeArg
class InstallUpdateArgs {
    lateinit var url: String
    var isForce: Boolean = false
}

@TauriPlugin
class UpdaterPlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun installUpdate(invoke: Invoke) {
        val args = invoke.parseArgs(InstallUpdateArgs::class.java)

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val mainActivity = activity as? MainActivity
                if (mainActivity != null) {
                    mainActivity.startApkUpdate(args.url, args.isForce)

                    val ret = JSObject()
                    ret.put("success", true)
                    invoke.resolve(ret)
                } else {
                    invoke.reject("MainActivity not found")
                }
            } catch (e: Exception) {
                invoke.reject(e.message ?: "Unknown error")
            }
        }
    }
}
