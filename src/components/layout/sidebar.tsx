import { cn } from "@/lib/utils";
import {
  Download,
  Send,
  Settings,
  Smartphone,
  Upload,
} from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: MessageDescriptor;
  href: string;
}

const navItems: NavItem[] = [
  { icon: Smartphone, label: msg`设备`, href: "/devices" },
  { icon: Upload, label: msg`发送文件`, href: "/send" },
  { icon: Download, label: msg`接收文件`, href: "/receive" },
  { icon: Settings, label: msg`设置`, href: "/settings" },
];

export function Sidebar() {
  const { _ } = useLingui();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside className="flex h-full w-[220px] flex-col gap-3 border-r border-sidebar-border bg-sidebar p-3">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-1">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-blue-500">
            <Send className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-sidebar-foreground">
            SwarmDrop
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map((item) => {
          const isActive = currentPath === item.href ||
            (item.href !== "/" && currentPath.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                isActive
                  ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px]",
                  isActive ? "text-blue-600" : "text-muted-foreground"
                )}
              />
              <span>{_(item.label)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer - User Info */}
      <div className="flex items-center justify-between px-1 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <span className="text-[11px] font-medium text-muted-foreground">
              YG
            </span>
          </div>
          <span className="text-[13px] text-sidebar-foreground">
            <Trans>我的 MacBook</Trans>
          </span>
        </div>
        <div className="flex items-center gap-1 rounded px-1.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="text-[11px] text-green-500">
            <Trans>在线</Trans>
          </span>
        </div>
      </div>
    </aside>
  );
}
