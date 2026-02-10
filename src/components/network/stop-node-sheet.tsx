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
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
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
  const { stopNetwork, status, listenAddrs, getConnectedCount, getDiscoveredCount, startedAt } =
    useNetworkStore(
      useShallow((s) => ({
        stopNetwork: s.stopNetwork,
        status: s.status,
        listenAddrs: s.listenAddrs,
        getConnectedCount: s.getConnectedCount,
        getDiscoveredCount: s.getDiscoveredCount,
        startedAt: s.startedAt,
      })),
    );

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
          connectedCount={getConnectedCount()}
          discoveredCount={getDiscoveredCount()}
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

  // 桌面端：与现有 NetworkDialog 运行状态布局一致
  return (
    <>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>
          <Trans>网络节点</Trans>
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          <Trans>管理 P2P 网络节点的启动和连接状态</Trans>
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            <Trans>节点状态</Trans>
          </span>
          <Badge variant="outline" className={cn("gap-1.5", config.className)}>
            <span className={cn("size-2 rounded-full", config.dotColor)} />
            {t(config.label)}
          </Badge>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">
            <Trans>监听地址</Trans>
          </span>
          <Card className="gap-0 bg-muted/50 py-0">
            <CardContent className="p-3">
              {listenAddrs.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {listenAddrs.map((addr, i) => (
                    <code
                      key={i}
                      className={cn(
                        "font-mono text-xs",
                        i === 0 ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {addr}
                    </code>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  <Trans>节点未启动</Trans>
                </span>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <Card className="gap-0 bg-muted/50 py-0">
            <CardContent className="flex flex-col gap-1 p-3">
              <span className="text-xs text-muted-foreground">
                <Trans>已连接节点</Trans>
              </span>
              <span className="text-2xl font-semibold text-foreground">
                {connectedCount}
              </span>
            </CardContent>
          </Card>
          <Card className="gap-0 bg-muted/50 py-0">
            <CardContent className="flex flex-col gap-1 p-3">
              <span className="text-xs text-muted-foreground">
                <Trans>已发现节点</Trans>
              </span>
              <span className="text-2xl font-semibold text-foreground">
                {discoveredCount}
              </span>
            </CardContent>
          </Card>
        </div>
      </div>

      <ResponsiveDialogFooter>
        <Button variant="destructive" onClick={onStop}>
          <Trans>停止节点</Trans>
        </Button>
      </ResponsiveDialogFooter>
    </>
  );
}
