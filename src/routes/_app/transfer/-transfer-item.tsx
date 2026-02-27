/**
 * TransferItem
 * 传输记录卡片 — 显示传输进度/状态
 */

import {
  ArrowUp,
  ArrowDown,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { Trans } from "@lingui/react/macro";
import type { TransferSession } from "@/commands/transfer";
import { cancelSend, cancelReceive } from "@/commands/transfer";
import {
  formatFileSize,
  formatSpeed,
  formatDuration,
  formatRelativeTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { openTransferResult } from "@/lib/file-picker";
import { useNavigate } from "@tanstack/react-router";

interface TransferItemProps {
  session: TransferSession;
}

export function TransferItem({ session }: TransferItemProps) {
  const navigate = useNavigate();
  const isSend = session.direction === "send";
  const isActive =
    session.status === "pending" ||
    session.status === "waiting_accept" ||
    session.status === "transferring";

  const handleClick = () => {
    void navigate({
      to: "/transfer/$sessionId",
      params: { sessionId: session.sessionId },
    });
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (isSend) {
        await cancelSend(session.sessionId);
      } else {
        await cancelReceive(session.sessionId);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleOpenFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await openTransferResult(session);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const progressPercent = session.progress
    ? Math.round(
        (session.progress.transferredBytes / session.progress.totalBytes) * 100,
      )
    : 0;

  return (
    <div
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card p-3.5 hover:bg-accent/50"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
    >
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
              <Trans>发送到 {session.deviceName}</Trans>
            ) : (
              <Trans>来自 {session.deviceName}</Trans>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {session.files.length} <Trans>个文件</Trans> ·{" "}
            {formatFileSize(session.totalSize)}
          </div>
        </div>

        {/* 状态图标或操作 */}
        {isActive && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={handleCancel}
          >
            <X className="size-4" />
          </Button>
        )}
        {session.status === "completed" && (
          <CheckCircle2 className="size-5 text-green-500" />
        )}
        {session.status === "failed" && (
          <XCircle className="size-5 text-destructive" />
        )}
        {session.status === "cancelled" && (
          <XCircle className="size-5 text-muted-foreground" />
        )}
      </div>

      {/* 传输进度（进行中） */}
      {session.status === "transferring" && session.progress && (
        <div className="flex flex-col gap-1.5">
          <Progress value={progressPercent} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {session.progress.currentFile?.name && (
                <>{session.progress.currentFile.name} · </>
              )}
              {formatSpeed(session.progress.speed)}
            </span>
            <span>
              {progressPercent}%
              {session.progress.eta != null && (
                <>
                  {" "}
                  · <Trans>剩余 {formatDuration(session.progress.eta)}</Trans>
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* 等待确认 */}
      {session.status === "waiting_accept" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <Trans>等待对方确认...</Trans>
        </div>
      )}

      {/* 已完成 — 时间 + 打开文件夹 */}
      {session.status === "completed" && session.completedAt && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatRelativeTime(session.completedAt)}</span>
          {session.savePath && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-2 text-xs"
                onClick={handleOpenFolder}
              >
                <FolderOpen className="size-3" />
                <Trans>打开文件夹</Trans>
              </Button>
            )}
        </div>
      )}

      {/* 失败 — 错误信息 */}
      {session.status === "failed" && session.error && (
        <div className="text-xs text-destructive">{session.error}</div>
      )}

      {/* 已取消 */}
      {session.status === "cancelled" && session.completedAt && (
        <div className="text-xs text-muted-foreground">
          <Trans>已取消</Trans> · {formatRelativeTime(session.completedAt)}
        </div>
      )}
    </div>
  );
}
