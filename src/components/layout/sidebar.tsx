import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Globe } from "lucide-react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { usePreferencesStore } from "@/stores/preferences-store";
import { locales, type LocaleKey } from "@/lib/i18n";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { navItems, isNavActive } from "@/components/layout/nav-items";

const themeOptions: {
  value: string;
  label: MessageDescriptor;
  icon: typeof Sun;
}[] = [
  { value: "system", label: msg`跟随系统`, icon: Monitor },
  { value: "light", label: msg`浅色`, icon: Sun },
  { value: "dark", label: msg`深色`, icon: Moon },
];

function ThemeIcon({ theme }: { theme: string | undefined }) {
  switch (theme) {
    case "light":
      return <Sun className="size-4" />;
    case "dark":
      return <Moon className="size-4" />;
    default:
      return <Monitor className="size-4" />;
  }
}

export function AppSidebar() {
  const { t } = useLingui();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { theme, setTheme } = useTheme();
  const locale = usePreferencesStore((s) => s.locale);
  const setLocale = usePreferencesStore((s) => s.setLocale);
  const { state, toggleSidebar, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === "desktop";

  // 断点变化时同步侧边栏状态（用 ref 避免 setOpen 引用变化导致重复触发）
  const prevIsDesktop = useRef(isDesktop);
  useEffect(() => {
    if (prevIsDesktop.current !== isDesktop) {
      prevIsDesktop.current = isDesktop;
      setOpen(isDesktop);
    }
  }, [isDesktop, setOpen]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader
        className="h-13 cursor-pointer justify-center pl-2.5"
        onClick={toggleSidebar}
      >
        <div className="flex items-center gap-2">
          <img
            src="/app-icon.svg"
            alt="SwarmDrop"
            className="size-7 shrink-0 rounded-md"
          />
          {!isCollapsed && (
            <span className="text-[15px] font-semibold text-sidebar-foreground">
              SwarmDrop
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="pt-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const isActive = isNavActive(currentPath, item.href);
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

      <SidebarFooter>
        <div className="flex flex-col gap-1">
          {/* 主题切换 Popover */}
          <Popover>
            <PopoverTrigger asChild className="cursor-pointer">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isCollapsed ? "size-8 justify-center" : "h-8 px-2.5",
                )}
              >
                <ThemeIcon theme={theme} />
                {!isCollapsed && (
                  <span className="text-[12px]">
                    {t(
                      themeOptions.find((o) => o.value === theme)?.label ??
                        themeOptions[0].label,
                    )}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side={isCollapsed ? "right" : "top"}
              align={isCollapsed ? "end" : "start"}
              className="w-36 p-1"
            >
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] transition-colors hover:bg-accent",
                      theme === option.value && "bg-accent font-medium",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {t(option.label)}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* 语言切换 Popover */}
          <Popover>
            <PopoverTrigger asChild className="cursor-pointer">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isCollapsed ? "size-8 justify-center" : "h-8 px-2.5",
                )}
              >
                <Globe className="size-4" />
                {!isCollapsed && (
                  <span className="text-[12px]">{locales[locale]}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side={isCollapsed ? "right" : "top"}
              align={isCollapsed ? "end" : "start"}
              className="w-36 p-1"
            >
              {Object.entries(locales).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLocale(key as LocaleKey)}
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-[13px] transition-colors hover:bg-accent",
                    locale === key && "bg-accent font-medium",
                  )}
                >
                  {label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
