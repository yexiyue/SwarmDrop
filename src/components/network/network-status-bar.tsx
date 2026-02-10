/**
 * NetworkStatusBar
 * 移动端内联网络状态条
 */

import { useNetworkStore, type NodeStatus } from "@/stores/network-store";
import { useShallow } from "zustand/shallow";
import { Trans } from "@lingui/react/macro";
import { cn } from "@/lib/utils";

interface NetworkStatusBarProps {
  onStopClick: () => void;
}

const barStyles: Record<NodeStatus, { bg: string; dotColor: string; textColor: string }> = {
  stopped: {
    bg: "bg-red-50",
    dotColor: "bg-red-600",
    textColor: "text-red-800",
  },
  starting: {
    bg: "bg-amber-50",
    dotColor: "bg-amber-500 animate-pulse",
    textColor: "text-amber-800",
  },
  running: {
    bg: "bg-green-50",
    dotColor: "bg-green-600",
    textColor: "text-green-800",
  },
  error: {
    bg: "bg-red-50",
    dotColor: "bg-red-600",
    textColor: "text-red-800",
  },
};

export function NetworkStatusBar({ onStopClick }: NetworkStatusBarProps) {
  const { status, getConnectedCount } = useNetworkStore(
    useShallow((s) => ({
      status: s.status,
      getConnectedCount: s.getConnectedCount,
    })),
  );

  const style = barStyles[status];
  const connectedCount = getConnectedCount();

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-[10px] px-3 py-3",
        style.bg,
      )}
    >
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

      {status === "running" && (
        <button
          type="button"
          onClick={onStopClick}
          className="rounded-md bg-red-100 px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-200"
        >
          <Trans>停止</Trans>
        </button>
      )}
    </div>
  );
}
