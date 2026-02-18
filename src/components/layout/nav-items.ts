import { ArrowLeftRight, Settings, Smartphone } from "lucide-react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

export interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: MessageDescriptor;
  href: string;
}

/** 桌面端侧边栏导航（3 项） */
export const desktopNavItems: NavItem[] = [
  { icon: Smartphone, label: msg`设备`, href: "/devices" },
  { icon: ArrowLeftRight, label: msg`传输`, href: "/transfer" },
  { icon: Settings, label: msg`设置`, href: "/settings" },
];

/** 移动端底部导航（3 项） */
export const mobileNavItems: NavItem[] = [
  { icon: Smartphone, label: msg`设备`, href: "/devices" },
  { icon: ArrowLeftRight, label: msg`传输`, href: "/transfer" },
  { icon: Settings, label: msg`设置`, href: "/settings" },
];

/** @deprecated 使用 desktopNavItems 或 mobileNavItems */
export const navItems = desktopNavItems;
