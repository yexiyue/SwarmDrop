/**
 * HistoryItem
 * 持久化传输历史记录卡片 — 显示从 DB 加载的传输记录
 */

import {
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { Trans } from "@lingui/react/macro";
import type { TransferHistoryItem } from "@/commands/transfer";
import {
  resumeTransfer,
  deleteTransferSession,
} from "@/commands/transfer";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { useTransferStore } from "@/stores/transfer-store";

interface HistoryItemProps {
  item: TransferHistoryItem;
}

export function HistoryItem({ item }: HistoryItemProps) {
  const loadHistory = useTransferStore((s) => s.loadHistory);
  const isSend = item.direction === "send";

  const handleResume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await resumeTransfer(item.sessionId);
      toast.success("恢复传输已发起");
      await loadHistory();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTransferSession(item.sessionId);
      await loadHistory();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const progressPercent =
    item.totalSize > 0
      ? Math.round((item.transferredBytes / item.totalSize) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3.5">
      {/* 头部：方向 + 设备名 + 状态/操作 */}
      <div className="flex items-center gap-2">
        {/* 方向图标 */}
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            isSend
              ? "bg-blue-100 text-blue-600"
              : "bg-green-100 text-green-600",
          )}
        >
          {isSend ? (
            <ArrowUp className="size-4" />
          ) : (
            <ArrowDown className="size-4" />
          )}
        </div>

        {/* 设备名 + 文件信息 */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {isSend ? (
              <Trans>发送到 {item.peerName}</Trans>
            ) : (
              <Trans>来自 {item.peerName}</Trans>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {item.files.length} <Trans>个文件</Trans> ·{" "}
            {formatFileSize(item.totalSize)}
          </div>
        </div>

        {/* 状态图标 */}
        {item.status === "completed" && (
          <CheckCircle2 className="size-5 text-green-500" />
        )}
        {item.status === "failed" && (
          <XCircle className="size-5 text-destructive" />
        )}
        {item.status === "cancelled" && (
          <XCircle className="size-5 text-muted-foreground" />
        )}
        {item.status === "paused" && (
          <Pause className="size-5 text-amber-500" />
        )}

        {/* 删除按钮 */}
        {item.status !== "transferring" && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>

      {/* 暂停状态 — 恢复按钮 + 进度 */}
      {item.status === "paused" && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-amber-600">
            <Trans>已暂停</Trans> · {progressPercent}%
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 text-xs"
            onClick={handleResume}
          >
            <Play className="size-3" />
            <Trans>恢复</Trans>
          </Button>
        </div>
      )}

      {/* 已完成 — 时间 */}
      {item.status === "completed" && item.finishedAt && (
        <div className="text-xs text-muted-foreground">
          {formatRelativeTime(item.finishedAt)}
        </div>
      )}

      {/* 失败 — 错误信息 */}
      {item.status === "failed" && (
        <div className="text-xs text-destructive">
          {item.errorMessage || <Trans>传输失败</Trans>}
          {item.finishedAt && (
            <span className="text-muted-foreground">
              {" "}
              · {formatRelativeTime(item.finishedAt)}
            </span>
          )}
        </div>
      )}

      {/* 已取消 */}
      {item.status === "cancelled" && item.finishedAt && (
        <div className="text-xs text-muted-foreground">
          <Trans>已取消</Trans> · {formatRelativeTime(item.finishedAt)}
        </div>
      )}
    </div>
  );
}
