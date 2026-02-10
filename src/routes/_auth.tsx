/**
 * Auth Layout
 * 认证相关页面的布局（无侧边栏）
 */

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";
import { AuroraBackground } from "@/components/ui/aurora-background";

export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ location }) => {
    const { isSetupComplete, isUnlocked, _tempPassword } =
      useAuthStore.getState();

    // 如果正在设置流程中（有临时密码），允许访问 enable-biometric
    const isInSetupFlow = _tempPassword !== null;
    if (isInSetupFlow && location.pathname === "/enable-biometric") {
      return;
    }

    // 如果已设置且已解锁，重定向到首页
    if (isSetupComplete && isUnlocked) {
      throw redirect({ to: "/devices" });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <AuroraBackground className="min-h-svh p-4">
      <Outlet />
    </AuroraBackground>
  );
}
