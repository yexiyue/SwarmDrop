import { Download, Settings, Smartphone, Upload } from "lucide-react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

export interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: MessageDescriptor;
  href: string;
}

export const navItems: NavItem[] = [
  { icon: Smartphone, label: msg`设备`, href: "/devices" },
  { icon: Upload, label: msg`发送文件`, href: "/send" },
  { icon: Download, label: msg`接收文件`, href: "/receive" },
  { icon: Settings, label: msg`设置`, href: "/settings" },
];
