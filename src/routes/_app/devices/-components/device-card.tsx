import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Link,
  Monitor,
  MoreHorizontal,
  RadioTower,
  Send,
  Smartphone,
  Unlink,
  Wifi,
  Zap,
  Laptop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import { Trans } from "@lingui/react/macro";
import type { Device, ConnectionType } from "@/commands/network";

/** 根据 OS 名称返回对应的设备图标 */
function getDeviceIcon(os: string): React.ComponentType<{ className?: string }> {
  const osLower = os.toLowerCase();
  if (osLower === "ios") return Smartphone;
  if (osLower === "android") return Smartphone;
  if (osLower === "macos" || osLower === "darwin") return Laptop;
  return Monitor;
}

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
};

interface DeviceCardProps {
  device: Device;
  variant?: "card" | "list";
  onSend?: (device: Device) => void;
  onConnect?: (device: Device) => void;
  onUnpair?: (device: Device) => void;
}

export function DeviceCard({ device, variant = "card", onSend, onConnect, onUnpair }: DeviceCardProps) {
  const { t } = useLingui();
  const DeviceIcon = getDeviceIcon(device.os);
  const isOnline = device.status === "online";
  const connConfig = device.connection ? connectionConfig[device.connection] : null;

  const [unpairOpen, setUnpairOpen] = useState(false);

  if (variant === "list") {
    return (
      <>
        <div className="flex items-center gap-3 rounded-xl border border-border p-3.5">
          {/* Avatar */}
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              device.isPaired && isOnline ? "bg-blue-50" : "bg-muted",
            )}
          >
            <DeviceIcon
              className={cn(
                "size-5.5",
                device.isPaired && isOnline ? "text-blue-600" : "text-muted-foreground",
              )}
            />
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[15px] font-medium text-foreground">
              {device.hostname}
            </span>
            {device.isPaired ? (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isOnline ? "bg-green-600" : "bg-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-xs",
                    isOnline ? "text-green-600" : "text-muted-foreground",
                  )}
                >
                  {isOnline ? <Trans>在线</Trans> : <Trans>离线</Trans>}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                <Trans>未配对</Trans>
              </span>
            )}
          </div>

          {/* Action */}
          {device.isPaired ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={!isOnline}
                onClick={() => onSend?.(device)}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full",
                  isOnline
                    ? "bg-blue-600 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Send className="size-4.5" />
              </button>
              {onUnpair && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setUnpairOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Unlink className="size-4" />
                      <Trans>取消配对</Trans>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onConnect?.(device)}
              className="shrink-0 rounded-full border border-blue-600 px-3.5 py-2 text-[13px] font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              <Trans>连接</Trans>
            </button>
          )}
        </div>

        {/* 取消配对确认弹窗 */}
        <UnpairAlertDialog
          open={unpairOpen}
          onOpenChange={setUnpairOpen}
          deviceName={device.hostname}
          onConfirm={() => onUnpair?.(device)}
        />
      </>
    );
  }

  // variant="card" — 桌面端纵向卡片样式
  return (
    <>
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
              {device.hostname}
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
          {/* More Menu (paired only) */}
          {device.isPaired && onUnpair && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setUnpairOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Unlink className="size-4" />
                  <Trans>取消配对</Trans>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Connection Badge */}
          {connConfig && device.latency !== undefined ? (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-1.5 py-0.5",
                connConfig.bgColor
              )}
            >
              <connConfig.icon className={cn("size-2.5", connConfig.textColor)} />
              <span className={cn("text-[10px] font-medium", connConfig.textColor)}>
                {t(connConfig.label)}
              </span>
              <span className={cn("text-[10px] font-medium", connConfig.textColor)}>
                {device.latency}ms
              </span>
            </div>
          ) : (
            <div />
          )}

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

      {/* 取消配对确认弹窗 */}
      <UnpairAlertDialog
        open={unpairOpen}
        onOpenChange={setUnpairOpen}
        deviceName={device.hostname}
        onConfirm={() => onUnpair?.(device)}
      />
    </>
  );
}

/** 取消配对确认弹窗 */
function UnpairAlertDialog({
  open,
  onOpenChange,
  deviceName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceName: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>取消配对</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>
              确定要取消与「{deviceName}」的配对吗？取消后需要重新配对才能传输文件。
            </Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans>取消</Trans>
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trans>确认取消配对</Trans>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
