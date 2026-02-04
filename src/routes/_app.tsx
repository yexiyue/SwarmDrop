/**
 * App Layout
 * 需要认证的页面布局（带侧边栏）
 */

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    const { isSetupComplete, isUnlocked } = useAuthStore.getState();

    // 如果未设置，重定向到欢迎页
    if (!isSetupComplete) {
      throw redirect({ to: "/welcome" });
    }

    // 如果未解锁，重定向到解锁页
    if (!isUnlocked) {
      throw redirect({ to: "/unlock" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <SidebarProvider
      className="h-svh"
      style={
        {
          "--sidebar-width": "220px",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
