/**
 * Index Route
 * 根据认证状态重定向
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const { isSetupComplete, isUnlocked } = useAuthStore.getState();

    // 首次启动 → 欢迎页
    if (!isSetupComplete) {
      throw redirect({ to: "/welcome" });
    }

    // 未解锁 → 解锁页
    if (!isUnlocked) {
      throw redirect({ to: "/unlock" });
    }

    // 已解锁 → 设备页
    throw redirect({ to: "/devices" });
  },
});
