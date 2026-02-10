import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useLingui } from "@lingui/react/macro";
import { useState, useEffect } from "react";
import { hostname } from "@tauri-apps/plugin-os";
import { useNetworkStore, type NodeStatus } from "@/stores/network-store";
import { NetworkDialog } from "@/components/network/network-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { navItems } from "@/components/layout/nav-items";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

const statusConfig: Record<
  NodeStatus,
  {
    label: MessageDescriptor;
    dotColor: string;
    bgColor: string;
    textColor: string;
  }
> = {
  stopped: {
    label: msg`离线`,
    dotColor: "bg-muted-foreground",
    bgColor: "hover:bg-muted",
    textColor: "text-muted-foreground",
  },
  starting: {
    label: msg`连接中`,
    dotColor: "bg-yellow-500 animate-pulse",
    bgColor: "bg-yellow-500/10 hover:bg-yellow-500/20",
    textColor: "text-yellow-600",
  },
  running: {
    label: msg`在线`,
    dotColor: "bg-green-500",
    bgColor: "bg-green-500/10 hover:bg-green-500/20",
    textColor: "text-green-500",
  },
  error: {
    label: msg`错误`,
    dotColor: "bg-red-500",
    bgColor: "bg-red-500/10 hover:bg-red-500/20",
    textColor: "text-red-500",
  },
};

export function AppSidebar() {
  const { t } = useLingui();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [networkDialogOpen, setNetworkDialogOpen] = useState(false);
  const [deviceName, setDeviceName] = useState<string>("");
  const status = useNetworkStore((state) => state.status);
  const config = statusConfig[status];
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  useEffect(() => {
    hostname().then((name) => setDeviceName(name ?? ""));
  }, []);

  const avatarInitials = deviceName
    ? deviceName.slice(0, 2).toUpperCase()
    : "SD";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-13 justify-center px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-blue-600 to-blue-500">
            <Send className="size-4 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-[15px] font-semibold text-sidebar-foreground">
              SwarmDrop
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-3 pt-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const isActive =
                  currentPath === item.href ||
                  (item.href !== "/" && currentPath.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={t(item.label)}
                      className="h-9 px-2.5 text-[13px]"
                    >
                      <Link to={item.href} preload="intent">
                        <Icon
                          className={cn(
                            "size-4.5",
                            isActive
                              ? "text-blue-600"
                              : "text-muted-foreground",
                          )}
                        />
                        <span>{t(item.label)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        <div className={cn(
          "flex items-center px-1",
          isCollapsed ? "justify-center" : "justify-between",
        )}>
          <div className="flex items-center gap-2">
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className="text-[11px]">
                {avatarInitials}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <span className="text-[13px] text-sidebar-foreground">
                {deviceName || "SwarmDrop"}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setNetworkDialogOpen(true)}
              className={cn(
                "flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 transition-colors",
                config.bgColor,
              )}
            >
              <span className={cn("size-1.5 rounded-full", config.dotColor)} />
              <span className={cn("text-[11px]", config.textColor)}>
                {t(config.label)}
              </span>
            </button>
          )}
        </div>
      </SidebarFooter>

      <NetworkDialog
        open={networkDialogOpen}
        onOpenChange={setNetworkDialogOpen}
      />
    </Sidebar>
  );
}
