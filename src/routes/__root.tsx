/**
 * Root Layout
 * 应用根布局
 */

import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { platform } from "@tauri-apps/plugin-os";
import {
  ForceUpdateDialog,
  PromptUpdateDialog,
} from "@/components/upgrade";
import { useUpgradeLinkStore } from "@/stores/upgrade-link-store";
// import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { status, checkForUpdate } = useUpgradeLinkStore();
  const [promptOpen, setPromptOpen] = useState(false);

  // 设置 Android 下载事件监听器
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const currentPlatform = await platform();
      if (currentPlatform === "android") {
        unlisten = await useUpgradeLinkStore.getState().setupAndroidListeners();
      }
    };

    void setup();

    return () => {
      unlisten?.();
    };
  }, []);

  // 应用启动时检查更新
  useEffect(() => {
    // 延迟检查，避免影响启动速度
    const timer = setTimeout(() => {
      void checkForUpdate();
    }, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  // 当有可用更新时显示提示弹窗
  useEffect(() => {
    if (status === "available") {
      setPromptOpen(true);
    }
  }, [status]);

  return (
    <>
      <Outlet />
      <ForceUpdateDialog />
      <PromptUpdateDialog open={promptOpen} onOpenChange={setPromptOpen} />
      {/* {import.meta.env.DEV && <TanStackRouterDevtools />} */}
    </>
  );
}
