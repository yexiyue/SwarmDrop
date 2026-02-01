import { cn } from "@/lib/utils";
import {
  Link,
  Monitor,
  RadioTower,
  Send,
  Smartphone,
  Tablet,
  Wifi,
  Zap,
  Laptop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";

export type DeviceType = "smartphone" | "tablet" | "laptop" | "desktop";
export type DeviceStatus = "online" | "offline";
export type ConnectionType = "lan" | "dcutr" | "relay" | "none";

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  connection?: ConnectionType;
  latency?: number;
  isPaired: boolean;
}

const deviceIcons: Record<DeviceType, React.ComponentType<{ className?: string }>> = {
  smartphone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  desktop: Monitor,
};

const connectionConfig: Record<
  ConnectionType,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: MessageDescriptor;
    bgColor: string;
    textColor: string;
  }
> = {
  lan: {
    icon: Wifi,
    label: msg`局域网`,
    bgColor: "bg-green-100",
    textColor: "text-green-600",
  },
  dcutr: {
    icon: Zap,
    label: msg`打洞`,
    bgColor: "bg-blue-100",
    textColor: "text-blue-600",
  },
  relay: {
    icon: RadioTower,
    label: msg`中继`,
    bgColor: "bg-amber-100",
    textColor: "text-amber-600",
  },
  none: {
    icon: Wifi,
    label: msg``,
    bgColor: "",
    textColor: "",
  },
};

interface DeviceCardProps {
  device: Device;
  onSend?: (device: Device) => void;
  onConnect?: (device: Device) => void;
}

export function DeviceCard({ device, onSend, onConnect }: DeviceCardProps) {
  const { _ } = useLingui();
  const DeviceIcon = deviceIcons[device.type];
  const isOnline = device.status === "online";
  const connection = device.connection ?? "none";
  const connConfig = connectionConfig[connection];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <DeviceIcon
            className={cn(
              "size-5",
              isOnline ? "text-blue-600" : "text-muted-foreground"
            )}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {device.name}
          </span>
          <div className="flex items-center gap-1">
            {device.isPaired ? (
              <>
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isOnline ? "bg-green-500" : "bg-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-xs",
                    isOnline ? "text-green-500" : "text-muted-foreground"
                  )}
                >
                  {isOnline ? <Trans>在线</Trans> : <Trans>离线</Trans>}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                <Trans>未配对</Trans>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Connection Badge */}
        {connection !== "none" && device.latency !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-1.5 py-0.5",
              connConfig.bgColor
            )}
          >
            <connConfig.icon className={cn("size-2.5", connConfig.textColor)} />
            <span className={cn("text-[10px] font-medium", connConfig.textColor)}>
              {_(connConfig.label)}
            </span>
            <span className={cn("text-[10px] font-medium", connConfig.textColor)}>
              {device.latency}ms
            </span>
          </div>
        )}
        {connection === "none" && <div />}

        {/* Action Button */}
        {device.isPaired ? (
          <Button
            size="sm"
            variant={isOnline ? "default" : "outline"}
            disabled={!isOnline}
            onClick={() => onSend?.(device)}
            className={cn(
              "h-auto gap-1.5 rounded-md px-3 py-1.5 text-xs",
              isOnline
                ? "bg-blue-600 hover:bg-blue-700"
                : "text-muted-foreground"
            )}
          >
            <Send className="size-3.5" />
            <Trans>发送</Trans>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConnect?.(device)}
            className="h-auto gap-1.5 rounded-md border-blue-600 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
          >
            <Link className="size-3.5" />
            <Trans>连接</Trans>
          </Button>
        )}
      </div>
    </div>
  );
}
