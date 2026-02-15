/**
 * App Layout
 * 需要认证的页面布局（带侧边栏）
 * - desktop (≥1024px): 侧边栏展开
 * - tablet (768-1023px): 侧边栏折叠为图标模式
 * - mobile (<768px): 隐藏侧边栏，显示底部导航栏
 */

import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect } from "react";
import { AppSidebar } from "@/components/layout/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useAuthStore } from "@/stores/auth-store";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { ConnectionRequestDialog } from "@/components/pairing/connection-request-dialog";
import { ForceUpdateDialog } from "@/components/ForceUpdateDialog";
import { useUpdateStore } from "@/stores/update-store";

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
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const isDesktop = breakpoint === "desktop";

  // 启动后延迟 3 秒自动检查更新
  useEffect(() => {
    const timer = setTimeout(() => {
      useUpdateStore.getState().checkForUpdate();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (isMobile) {
    return (
      <div className="flex h-svh flex-col">
        <MobileHeader />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
        <BottomNav />
        <ConnectionRequestDialog />
        <ForceUpdateDialog />
      </div>
    );
  }

  return (
    <SidebarProvider
      className="h-svh"
      defaultOpen={isDesktop}
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
      <ConnectionRequestDialog />
      <ForceUpdateDialog />
    </SidebarProvider>
  );
}

function MobileHeader() {
  return (
    <header className="flex items-center justify-between px-5 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <span className="text-2xl font-bold text-foreground">SwarmDrop</span>
      <Link
        to="/pairing"
        className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700"
      >
        <Plus className="size-5" />
      </Link>
    </header>
  );
}
