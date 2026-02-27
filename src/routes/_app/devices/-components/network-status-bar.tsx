/**
 * NetworkStatusBar
 * 网络状态条 — 移动端/桌面端共用
 */

import { useNetworkStore, type NodeStatus } from "@/stores/network-store";
import { useShallow } from "zustand/shallow";
import { Trans } from "@lingui/react/macro";
import { cn } from "@/lib/utils";
import type { NetworkStatus } from "@/commands/network";

interface NetworkStatusBarProps {
  onStopClick?: () => void;
}

const barStyles: Record<NodeStatus, { bg: string; dotColor: string; textColor: string }> = {
  stopped: {
    bg: "bg-red-50 dark:bg-red-950",
    dotColor: "bg-red-600",
    textColor: "text-red-800 dark:text-red-200",
  },
  starting: {
    bg: "bg-amber-50 dark:bg-amber-950",
    dotColor: "bg-amber-500 animate-pulse",
    textColor: "text-amber-800 dark:text-amber-200",
  },
  running: {
    bg: "bg-green-50 dark:bg-green-950",
    dotColor: "bg-green-600",
    textColor: "text-green-800 dark:text-green-200",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950",
    dotColor: "bg-red-600",
    textColor: "text-red-800 dark:text-red-200",
  },
};

/** 单个状态指示点 */
function StatusDot({
  ok,
  label,
}: {
  ok: boolean;
  label: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          ok ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600",
        )}
      />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}

/** 详细网络状态指示器（引导节点/中继/NAT） */
function NetworkIndicators({ networkStatus }: { networkStatus: NetworkStatus }) {
  return (
    <div className="flex items-center gap-3">
      <StatusDot
        ok={networkStatus.bootstrapConnected}
        label={<Trans>引导节点</Trans>}
      />
      <StatusDot
        ok={networkStatus.relayReady}
        label={<Trans>中继</Trans>}
      />
      <StatusDot
        ok={networkStatus.natStatus === "public"}
        label={<Trans>NAT</Trans>}
      />
    </div>
  );
}

export function NetworkStatusBar({ onStopClick }: NetworkStatusBarProps) {
  const { status, networkStatus, getConnectedCount } = useNetworkStore(
    useShallow((s) => ({
      status: s.status,
      networkStatus: s.networkStatus,
      getConnectedCount: s.getConnectedCount,
    })),
  );

  const style = barStyles[status];
  const connectedCount = getConnectedCount();

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[10px] px-3 py-3",
        style.bg,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", style.dotColor)} />
          <span className={cn("text-[13px] font-medium", style.textColor)}>
            {status === "running" && (
              <Trans>
                P2P 节点运行中 · {connectedCount} 台设备在线
              </Trans>
            )}
            {status === "stopped" && <Trans>P2P 节点未启动</Trans>}
            {status === "starting" && <Trans>节点启动中...</Trans>}
            {status === "error" && <Trans>节点错误</Trans>}
          </span>
        </div>

        {status === "running" && onStopClick && (
          <button
            type="button"
            onClick={onStopClick}
            className="rounded-md bg-red-100 px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
          >
            <Trans>停止</Trans>
          </button>
        )}
      </div>

      {/* 运行时展示详细网络状态 */}
      {status === "running" && networkStatus && (
        <NetworkIndicators networkStatus={networkStatus} />
      )}
    </div>
  );
}
