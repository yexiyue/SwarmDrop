/**
 * StopNodeSheet
 * 停止节点确认弹窗（移动端 Bottom Sheet / 桌面端 Dialog）
 */

import { Power } from "lucide-react";
import { useNetworkStore } from "@/stores/network-store";
import { useSecretStore } from "@/stores/secret-store";
import { useShallow } from "zustand/shallow";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { cn } from "@/lib/utils";
import { formatUptime } from "@/lib/format-uptime";
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

  const deviceId = useSecretStore((s) => s.deviceId);

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
}: {
  onStop: () => void;
  onCancel: () => void;
  status: NodeStatus;
  listenAddrs: string[];
  connectedCount: number;
  discoveredCount: number;
  startedAt: number | null;
  peerId: string | null;
}) {
  const { t } = useLingui();
  const { isMobile } = useResponsiveDialog();
  const config = statusConfig[status];

  const truncatedPeerId = peerId
    ? `${peerId.slice(0, 4)}...${peerId.slice(-5)}`
    : "—";

  const uptimeText = startedAt ? formatUptime(startedAt) : "—";

  if (isMobile) {
    return (
      <div className="flex flex-col gap-5 px-6 pb-8 pt-2">
        {/* Icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-16 items-center justify-center rounded-full bg-red-100">
            <Power className="size-7 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            <Trans>停止 P2P 节点</Trans>
          </h2>
          <p className="text-center text-sm text-muted-foreground">
            <Trans>
              停止后将断开所有连接，{"\n"}其他设备将无法发现你。
            </Trans>
          </p>
        </div>

        {/* Node Info Card */}
        <div className="overflow-hidden rounded-[10px] bg-red-50">
          <div className="flex items-center justify-between px-3.5 py-3">
            <span className="text-[13px] font-medium text-muted-foreground">
              Peer ID
            </span>
            <span className="text-[13px] font-semibold text-foreground">
              {truncatedPeerId}
            </span>
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
        </div>

        {/* Warning */}
        <p className="text-center text-xs font-medium text-red-600">
          <Trans>所有活跃连接将被断开</Trans>
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
        <div className="flex size-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
          <Power className="size-6 text-red-600 dark:text-red-400" />
        </div>
        <ResponsiveDialogTitle>
          <Trans>停止 P2P 节点</Trans>
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          <Trans>停止后将断开所有连接，其他设备将无法发现你。</Trans>
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className="flex flex-col gap-3">
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
        </div>

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

      <ResponsiveDialogFooter className="flex gap-2 sm:flex-row">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          <Trans>取消</Trans>
        </Button>
        <Button variant="destructive" onClick={onStop} className="flex-1">
          <Trans>停止节点</Trans>
        </Button>
      </ResponsiveDialogFooter>
    </>
  );
}
