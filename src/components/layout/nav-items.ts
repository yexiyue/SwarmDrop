import { ArrowLeftRight, Settings, Smartphone } from "lucide-react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

export interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: MessageDescriptor;
  href: string;
}

/** 导航项（桌面端和移动端共用） */
export const navItems: NavItem[] = [
  { icon: Smartphone, label: msg`设备`, href: "/devices" },
  { icon: ArrowLeftRight, label: msg`传输`, href: "/transfer" },
  { icon: Settings, label: msg`设置`, href: "/settings" },
];

/** 判断导航项是否处于激活状态 */
export function isNavActive(currentPath: string, href: string): boolean {
  if (currentPath === href) return true;
  if (href === "/devices" && currentPath.startsWith("/pairing")) return true;
  return href !== "/" && currentPath.startsWith(href);
}
