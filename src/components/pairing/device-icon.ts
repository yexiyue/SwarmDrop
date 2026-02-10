/**
 * 设备图标工具
 * 根据操作系统名称返回对应的 Lucide 图标组件
 */

import type { ComponentType } from "react";
import { Monitor, Smartphone, Laptop } from "lucide-react";

const deviceIcons: Record<string, ComponentType<{ className?: string }>> = {
  windows: Monitor,
  linux: Monitor,
  macos: Laptop,
  darwin: Laptop,
  ios: Smartphone,
  android: Smartphone,
};

export function getDeviceIcon(os: string) {
  return deviceIcons[os.toLowerCase()] ?? Monitor;
}
