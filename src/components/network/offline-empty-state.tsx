/**
 * OfflineEmptyState
 * 移动端节点离线时的空状态提示
 */

import { WifiOff, Play } from "lucide-react";
import { Trans } from "@lingui/react/macro";

interface OfflineEmptyStateProps {
  onStartClick: () => void;
}

export function OfflineEmptyState({ onStartClick }: OfflineEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <WifiOff className="size-9 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        <Trans>节点未启动</Trans>
      </h2>
      <p className="text-center text-sm text-muted-foreground">
        <Trans>启动 P2P 节点后才能发现设备和传输文件</Trans>
      </p>
      <button
        type="button"
        onClick={onStartClick}
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700"
      >
        <Play className="size-[18px]" />
        <Trans>启动节点</Trans>
      </button>
    </div>
  );
}
