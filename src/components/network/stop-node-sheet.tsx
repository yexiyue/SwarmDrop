/**
 * StopNodeSheet
 * 停止节点确认弹窗（移动端 Bottom Sheet / 桌面端 Dialog）
 */

import { platform, type as osType } from "@tauri-apps/plugin-os";
import { useNetworkStore } from "@/stores/network-store";
import { useSecretStore } from "@/stores/secret-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useShallow } from "zustand/shallow";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { cn } from "@/lib/utils";
import { formatUptime } from "@/lib/format-uptime";
import { getDeviceIcon } from "@/components/pairing/device-icon";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  useResponsiveDialog,
} from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NodeStatus } from "@/stores/network-store";

interface StopNodeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<
  NodeStatus,
  { label: MessageDescriptor; dotColor: string; className: string }
> = {
  stopped: {
    label: msg`未启动`,
    dotColor: "bg-muted-foreground",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  starting: {
    label: msg`启动中`,
    dotColor: "bg-yellow-500 animate-pulse",
    className: "bg-yellow-500/10 text-yellow-600 border-transparent",
  },
  running: {
    label: msg`运行中`,
    dotColor: "bg-green-500",
    className: "bg-green-500/10 text-green-600 border-transparent",
  },
  error: {
    label: msg`错误`,
    dotColor: "bg-red-500",
    className: "bg-red-500/10 text-red-600 border-transparent",
  },
};

export function StopNodeSheet({ open, onOpenChange }: StopNodeSheetProps) {
  const { stopNetwork, status, networkStatus, startedAt } =
    useNetworkStore(
      useShallow((s) => ({
        stopNetwork: s.stopNetwork,
        status: s.status,
        networkStatus: s.networkStatus,
        startedAt: s.startedAt,
      })),
    );

  const listenAddrs = networkStatus?.listenAddrs ?? [];
  const connectedCount = networkStatus?.connectedPeers ?? 0;
  const discoveredCount = networkStatus?.discoveredPeers ?? 0;
  const natStatus = networkStatus?.natStatus ?? "unknown";
  const relayReady = networkStatus?.relayReady ?? false;
  const publicAddr = networkStatus?.publicAddr ?? null;
  const relayPeers = networkStatus?.relayPeers ?? [];
  const bootstrapConnected = networkStatus?.bootstrapConnected ?? false;

  const deviceId = useSecretStore((s) => s.deviceId);
  const deviceName = usePreferencesStore((s) => s.deviceName);

  const currentPlatform = platform();
  const currentOsType = osType();
  const DeviceIcon = getDeviceIcon(currentOsType);

  const handleStop = async () => {
    await stopNetwork();
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <StopNodeContent
          onStop={handleStop}
          onCancel={() => onOpenChange(false)}
          status={status}
          listenAddrs={listenAddrs}
          connectedCount={connectedCount}
          discoveredCount={discoveredCount}
          startedAt={startedAt}
          peerId={deviceId}
          deviceName={deviceName}
          platformName={currentPlatform}
          DeviceIcon={DeviceIcon}
          natStatus={natStatus}
          relayReady={relayReady}
          publicAddr={publicAddr}
          relayPeers={relayPeers}
          bootstrapConnected={bootstrapConnected}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function StopNodeContent({
  onStop,
  onCancel,
  status,
  listenAddrs,
  connectedCount,
  discoveredCount,
  startedAt,
  peerId,
  deviceName,
  platformName,
  DeviceIcon,
  natStatus,
  relayReady,
  publicAddr,
  relayPeers,
  bootstrapConnected,
}: {
  onStop: () => void;
  onCancel: () => void;
  status: NodeStatus;
  listenAddrs: string[];
  connectedCount: number;
  discoveredCount: number;
  startedAt: number | null;
  peerId: string | null;
  deviceName: string;
  platformName: string;
  DeviceIcon: React.ComponentType<{ className?: string }>;
  natStatus: string;
  relayReady: boolean;
  publicAddr: string | null;
  relayPeers: string[];
  bootstrapConnected: boolean;
}) {
  const { t } = useLingui();
  const { isMobile } = useResponsiveDialog();
  const config = statusConfig[status];

  const truncatedPeerId = peerId
    ? `${peerId.slice(0, 4)}...${peerId.slice(-5)}`
    : "—";

  const uptimeText = startedAt ? formatUptime(startedAt) : "—";
  const displayName = deviceName || "SwarmDrop";
  const avatarInitials = displayName.slice(0, 2).toUpperCase();

  const platformLabel: Record<string, string> = {
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    android: "Android",
    ios: "iOS",
  };

  if (isMobile) {
    return (
      <div className="flex flex-col gap-5 px-6 pb-8 pt-2">
        {/* 设备身份 */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20">
              <span className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {avatarInitials}
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-lg border border-border bg-background shadow-sm">
              <DeviceIcon className="size-3 text-muted-foreground" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">
              {displayName}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {platformLabel[platformName] ?? platformName}
            </p>
          </div>
        </div>

        {/* Node Info Card */}
        <div className="overflow-hidden rounded-[10px] bg-muted/50 dark:bg-muted/30">
          <div className="flex items-center justify-between px-3.5 py-3">
            <span className="text-[13px] font-medium text-muted-foreground">
              <Trans>节点状态</Trans>
            </span>
            <Badge variant="outline" className={cn("gap-1.5 text-[12px]", config.className)}>
              <span className={cn("size-1.5 rounded-full", config.dotColor)} />
              {t(config.label)}
            </Badge>
          </div>
          <div className="flex items-center justify-between border-t border-border px-3.5 py-3">
            <span className="text-[13px] font-medium text-muted-foreground">
              Peer ID
            </span>
            <code className="font-mono text-[13px] font-semibold text-foreground">
              {truncatedPeerId}
            </code>
          </div>
          <div className="flex items-center justify-between border-t border-border px-3.5 py-3">
            <span className="text-[13px] font-medium text-muted-foreground">
              <Trans>运行时长</Trans>
            </span>
            <span className="text-[13px] font-semibold text-foreground">
              {uptimeText}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border px-3.5 py-3">
            <span className="text-[13px] font-medium text-muted-foreground">
              <Trans>已连接设备</Trans>
            </span>
            <span className="text-[13px] font-semibold text-foreground">
              <Trans>{connectedCount} 台</Trans>
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border px-3.5 py-3">
            <span className="text-[13px] font-medium text-muted-foreground">
              NAT
            </span>
            <Badge
              variant="outline"
              className={cn(
                "border-transparent text-[12px]",
                natStatus === "public"
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {natStatus === "public" ? t`映射成功` : t`未知`}
            </Badge>
          </div>
          <div className="flex items-center justify-between border-t border-border px-3.5 py-3">
            <span className="text-[13px] font-medium text-muted-foreground">
              <Trans>中继 / 引导</Trans>
            </span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "border-transparent text-[12px]",
                  relayReady
                    ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {relayReady ? t`中继就绪` : t`中继未连`}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "border-transparent text-[12px]",
                  bootstrapConnected
                    ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {bootstrapConnected ? t`引导已连` : t`引导未连`}
              </Badge>
            </div>
          </div>
        </div>

        {/* Warning */}
        <p className="text-center text-xs font-medium text-red-600 dark:text-red-400">
          <Trans>停止后将断开所有连接，其他设备将无法发现你</Trans>
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onStop}
            className="flex h-12 items-center justify-center rounded-xl bg-red-600 text-base font-semibold text-white transition-colors hover:bg-red-700"
          >
            <Trans>停止节点</Trans>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 items-center justify-center rounded-xl text-base font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Trans>取消</Trans>
          </button>
        </div>
      </div>
    );
  }

  // 桌面端
  return (
    <>
      <ResponsiveDialogHeader className="items-center text-center">
        {/* 设备身份卡片 */}
        <div className="relative">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20">
            <span className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {avatarInitials}
            </span>
          </div>
          <div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-lg border border-border bg-background shadow-sm">
            <DeviceIcon className="size-3.5 text-muted-foreground" />
          </div>
        </div>
        <div>
          <ResponsiveDialogTitle>{displayName}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {platformLabel[platformName] ?? platformName}
          </ResponsiveDialogDescription>
        </div>
      </ResponsiveDialogHeader>

      <div className="flex flex-col gap-3">
        {/* 统计数据 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border py-3">
            <span className="text-2xl font-bold text-foreground">
              {connectedCount}
            </span>
            <span className="text-xs text-muted-foreground">
              <Trans>已连接节点</Trans>
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border py-3">
            <span className="text-2xl font-bold text-foreground">
              {discoveredCount}
            </span>
            <span className="text-xs text-muted-foreground">
              <Trans>已发现节点</Trans>
            </span>
          </div>
        </div>

        {/* 节点信息卡片 */}
        <div className="overflow-hidden rounded-xl border border-border">
          {/* 状态 */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">
              <Trans>节点状态</Trans>
            </span>
            <Badge variant="outline" className={cn("gap-1.5", config.className)}>
              <span className={cn("size-2 rounded-full", config.dotColor)} />
              {t(config.label)}
            </Badge>
          </div>
          {/* Peer ID */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">Peer ID</span>
            <code className="font-mono text-sm text-foreground">
              {truncatedPeerId}
            </code>
          </div>
          {/* 运行时长 */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">
              <Trans>运行时长</Trans>
            </span>
            <span className="text-sm font-medium text-foreground">
              {uptimeText}
            </span>
          </div>
          {/* NAT 状态 */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">
              <Trans>NAT 状态</Trans>
            </span>
            <Badge
              variant="outline"
              className={cn(
                "border-transparent text-xs",
                natStatus === "public"
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {natStatus === "public" ? t`映射成功` : t`未知`}
            </Badge>
          </div>
          {/* 中继状态 */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">
              <Trans>中继节点</Trans>
            </span>
            <div className="flex items-center gap-2">
              {relayPeers.length > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {relayPeers.length}
                </span>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "border-transparent text-xs",
                  relayReady
                    ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {relayReady ? t`已就绪` : t`未连接`}
              </Badge>
            </div>
          </div>
          {/* 引导节点 */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">
              <Trans>引导节点</Trans>
            </span>
            <Badge
              variant="outline"
              className={cn(
                "border-transparent text-xs",
                bootstrapConnected
                  ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {bootstrapConnected ? t`已连接` : t`未连接`}
            </Badge>
          </div>
          {/* 公网地址 */}
          {publicAddr && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">
                <Trans>公网地址</Trans>
              </span>
              <code className="max-w-55 truncate font-mono text-xs text-foreground">
                {publicAddr}
              </code>
            </div>
          )}
        </div>

        {/* 监听地址（折叠） */}
        {listenAddrs.length > 0 && (
          <details className="group rounded-xl border border-border">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">
              <Trans>监听地址</Trans>
              <span className="text-xs tabular-nums">
                {listenAddrs.length}
              </span>
            </summary>
            <div className="max-h-32 overflow-y-auto border-t border-border px-4 py-2.5">
              <div className="flex flex-col gap-1">
                {listenAddrs.map((addr, i) => (
                  <code
                    key={i}
                    className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground"
                  >
                    {addr}
                  </code>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>

      {/* 警告 + 按钮 */}
      <ResponsiveDialogFooter className="flex flex-col gap-3">
        <p className="text-center text-xs text-red-500 dark:text-red-400">
          <Trans>停止后将断开所有连接，其他设备将无法发现你</Trans>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            <Trans>取消</Trans>
          </Button>
          <Button variant="destructive" onClick={onStop} className="flex-1">
            <Trans>停止节点</Trans>
          </Button>
        </div>
      </ResponsiveDialogFooter>
    </>
  );
}
