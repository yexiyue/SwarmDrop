/**
 * TransferItem
 * 传输记录卡片 — 显示传输进度/状态
 * 通过 sessionId 独立订阅 store，避免父组件重渲染
 */

import { memo, useCallback } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Pause,
  CheckCircle2,
  XCircle,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { cancelSend, cancelReceive, pauseTransfer } from "@/commands/transfer";
import { useTransferStore } from "@/stores/transfer-store";
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
  sessionId: string;
}

export const TransferItem = memo(function TransferItem({
  sessionId,
}: TransferItemProps) {
  const session = useTransferStore(
    useCallback((s) => s.sessions[sessionId], [sessionId]),
  );
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    navigate({
      to: "/transfer/$sessionId",
      params: { sessionId },
    });
  }, [navigate, sessionId]);

  const handlePause = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      useTransferStore.getState().cancelSession(sessionId);
      try {
        await pauseTransfer(sessionId);
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    },
    [sessionId],
  );

  const handleCancel = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      // 乐观更新：立即从 UI 移除
      useTransferStore.getState().cancelSession(sessionId);
      // 异步通知后端取消
      try {
        if (session?.direction === "send") {
          await cancelSend(sessionId);
        } else {
          await cancelReceive(sessionId);
        }
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    },
    [sessionId, session?.direction],
  );

  const handleOpenFolder = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const currentSession = useTransferStore.getState().sessions[sessionId];
      if (!currentSession) return;
      try {
        await openTransferResult(currentSession);
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    },
    [sessionId],
  );

  if (!session) return null;

  const isSend = session.direction === "send";
  const isActive =
    session.status === "pending" ||
    session.status === "waiting_accept" ||
    session.status === "transferring";

  const progressPercent =
    session.progress && session.progress.totalBytes > 0
      ? Math.round(
          (session.progress.transferredBytes / session.progress.totalBytes) *
            100,
        )
      : 0;

  const activeFileName = session.progress?.files?.find(
    (f) => f.status === "transferring",
  )?.name;

  return (
    <div
      className="group relative flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/40 hover:shadow-sm md:gap-3.5 md:p-4"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
    >
      {/* 1. 左侧：方向图标 */}
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg md:size-11 md:rounded-xl",
          isSend
            ? "bg-blue-50 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400"
            : "bg-green-50 text-green-500 dark:bg-green-500/15 dark:text-green-400",
        )}
      >
        {isSend ? (
          <ArrowUpRight className="size-4 md:size-5" strokeWidth={2.5} />
        ) : (
          <ArrowDownLeft className="size-4 md:size-5" strokeWidth={2.5} />
        )}
      </div>

      {/* 2. 中间：详细信息 */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5 md:gap-1.5">
        {/* 第一行：方向 + 设备名 */}
        <h3 className="truncate text-sm font-medium text-foreground md:text-[15px]">
          {isSend ? (
            <Trans>发送到 {session.deviceName}</Trans>
          ) : (
            <Trans>来自 {session.deviceName}</Trans>
          )}
        </h3>

        {/* 第二行：文件数 + 大小 */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground md:text-[13px]">
          <span>
            {session.files.length} <Trans>个文件</Trans>
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>{formatFileSize(session.totalSize)}</span>
        </div>

        {/* 第三行：状态区域 */}
        <div className="mt-0.5">
          {/* 传输进度 */}
          {session.status === "transferring" && session.progress && (
            <div className="flex max-w-sm flex-col gap-2 mt-1">
              <Progress value={progressPercent} className="h-1.5" />
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span className="max-w-[10em] truncate">
                    {activeFileName || t`传输中`}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {formatSpeed(session.progress.speed)} · {progressPercent}%
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
            <div className="flex items-center gap-1.5 text-[13px] text-amber-600 dark:text-amber-400">
              <Loader2 className="size-3.5 animate-spin" />
              <Trans>等待对方确认...</Trans>
            </div>
          )}

          {/* 等待中 */}
          {session.status === "pending" && (
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              <Trans>准备中...</Trans>
            </div>
          )}

          {/* 已完成 */}
          {session.status === "completed" && (
            <div className="flex items-center gap-1.5 text-[13px] text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              <Trans>传输完成</Trans>
              {session.completedAt && (
                <span className="text-muted-foreground">
                  — {formatRelativeTime(session.completedAt)}
                </span>
              )}
            </div>
          )}

          {/* 失败 */}
          {session.status === "failed" && (
            <div className="flex items-center gap-1.5 text-[13px] text-destructive">
              <XCircle className="size-4 shrink-0" />
              <span className="truncate">{session.error || t`传输失败`}</span>
            </div>
          )}

          {/* 已取消 */}
          {session.status === "cancelled" && (
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <XCircle className="size-4" />
              <Trans>已取消</Trans>
              {session.completedAt && (
                <span>— {formatRelativeTime(session.completedAt)}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. 右侧：操作按钮 */}
      <div className="flex shrink-0 items-start gap-0.5 -mr-1 md:gap-1 md:-mr-2">
        {session.status === "transferring" && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:bg-accent hover:text-foreground md:size-8"
            onClick={handlePause}
            title={t`暂停传输`}
          >
            <Pause className="size-4" />
          </Button>
        )}
        {isActive && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:size-8"
            onClick={handleCancel}
            title={t`取消传输`}
          >
            <X className="size-4" />
          </Button>
        )}
        {session.status === "completed" && session.saveLocation && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:bg-accent hover:text-foreground md:size-8"
            onClick={handleOpenFolder}
            title={t`打开文件夹`}
          >
            <FolderOpen className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
});
