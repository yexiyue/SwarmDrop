import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Trash2,
  RotateCcw,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Video,
  Music,
  File,
  FolderOpen,
} from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { TransferHistoryItem } from "@/commands/transfer";
import { resumeTransfer, deleteTransferSession } from "@/commands/transfer";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { useTransferStore } from "@/stores/transfer-store";
import { useNavigate } from "@tanstack/react-router";
import { openTransferResult } from "@/lib/file-picker";

interface HistoryItemProps {
  item: TransferHistoryItem;
}

/** 辅助函数：截断 PeerId 以美化显示 */
const truncatePeerId = (id?: string) =>
  !id ? "" : id.length <= 16 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`;

/** 根据文件名后缀获取图标 */
function getFileIcon(fileName: string, count: number) {
  if (count > 1) return <FileArchive className="size-5 text-amber-500" />;
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(fileName))
    return <ImageIcon className="size-5 text-green-500" />;
  if (/\.(mp4|mov|avi|mkv|webm|flv)$/i.test(fileName))
    return <Video className="size-5 text-purple-500" />;
  if (/\.(mp3|wav|flac|aac|ogg|wma)$/i.test(fileName))
    return <Music className="size-5 text-pink-500" />;
  if (/\.(zip|rar|7z|tar|gz|bz2)$/i.test(fileName))
    return <FileArchive className="size-5 text-amber-500" />;
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md)$/i.test(fileName))
    return <FileText className="size-5 text-blue-500" />;
  return <File className="size-5 text-muted-foreground" />;
}

export function HistoryItem({ item }: HistoryItemProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { loadHistory, addSession } = useTransferStore();

  const {
    sessionId,
    direction,
    peerId,
    peerName,
    files,
    totalSize,
    status,
    errorMessage,
    startedAt,
    finishedAt,
    transferredBytes,
  } = item;

  // 事件处理
  const withAction =
    (action: () => Promise<void>) => async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await action();
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    };

  const onResume = withAction(async () => {
    const result = await resumeTransfer(sessionId);
    addSession({
      sessionId: result.sessionId,
      direction: result.direction as "send" | "receive",
      peerId: result.peerId,
      deviceName: result.peerName,
      files: result.files,
      totalSize: result.totalSize,
      status: "transferring",
      progress: null,
      error: null,
      startedAt: Date.now(),
      completedAt: null,
    });
    await loadHistory();
    navigate({
      to: "/transfer/$sessionId",
      params: { sessionId: result.sessionId },
    });
  });

  const onDelete = withAction(async () => {
    await deleteTransferSession(sessionId);
    await loadHistory();
  });

  const onOpenFolder = withAction(async () => {
    if (!item.savePath) return;
    await openTransferResult({
      saveLocation: item.savePath ?? undefined,
      files: files.map((f) => ({ relativePath: f.relativePath })),
    });
  });

  const handleClick = () => {
    navigate({
      to: "/transfer/$sessionId",
      params: { sessionId },
    });
  };

  // 计算数据
  const isSend = direction === "send";
  const fileCount = files?.length || 0;
  const firstFileName = files?.[0]?.name || t`未知文件`;
  const displayFileName =
    fileCount > 1 ? t`${firstFileName} 等 ${fileCount} 个文件` : firstFileName;
  const progressPercent =
    totalSize > 0 ? Math.round((transferredBytes / totalSize) * 100) : 0;
  const canResume = status === "failed" || status === "paused";

  return (
    <div
      className="group relative flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/40 hover:shadow-sm md:gap-3.5 md:p-4"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
    >
      {/* 1. 左侧：方向大图标 */}
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

      {/* 2. 中间：详细信息 (文件名、设备与时间、状态) */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5 md:gap-1.5">
        {/* 第一行：文件名 */}
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="hidden md:inline-flex">{getFileIcon(firstFileName, fileCount)}</span>
          <h3
            className="truncate text-sm font-medium text-foreground md:text-[15px]"
            title={displayFileName}
          >
            {displayFileName}
          </h3>
        </div>

        {/* 第二行：传输元数据 */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground md:text-[13px]">
          <span className="shrink-0">
            {isSend ? <Trans>发送到</Trans> : <Trans>来自</Trans>}
          </span>
          <span className="max-w-[6em] truncate font-medium text-foreground/80 md:max-w-[8em]">
            {peerName || truncatePeerId(peerId)}
          </span>
          <span className="shrink-0 text-muted-foreground/40">·</span>
          <span className="shrink-0">{formatFileSize(totalSize)}</span>
          <span className="hidden shrink-0 text-muted-foreground/40 md:inline">·</span>
          <span className="hidden shrink-0 md:inline">
            {formatRelativeTime(finishedAt || startedAt)}
          </span>
        </div>

        {/* 第三行：状态栏 */}
        <div className="mt-0.5">
          {status === "completed" && (
            <div className="flex items-center gap-1.5 text-[13px] text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              <Trans>传输完成</Trans>
              <span className="text-muted-foreground">
                — {formatFileSize(transferredBytes)}
              </span>
            </div>
          )}

          {status === "paused" && (
            <div className="flex max-w-sm flex-col gap-2 mt-1">
              <Progress value={progressPercent} className="h-1.5" />
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Pause className="size-3.5" />
                  <Trans>已暂停</Trans>
                </span>
                <span className="text-muted-foreground">
                  {formatFileSize(transferredBytes)} /{" "}
                  {formatFileSize(totalSize)} · {progressPercent}%
                </span>
              </div>
            </div>
          )}

          {status === "failed" && (
            <div className="flex items-center gap-1.5 text-[13px] text-destructive">
              <XCircle className="size-4 shrink-0" />
              <span className="truncate">{errorMessage || t`传输失败`}</span>
            </div>
          )}

          {status === "cancelled" && (
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <XCircle className="size-4" />
              <Trans>已取消</Trans>
            </div>
          )}
        </div>
      </div>

      {/* 3. 右侧：操作按钮组 (靠右上对齐) */}
      <div className="flex shrink-0 items-start gap-0.5 -mr-1 md:gap-1 md:-mr-2">
        {canResume && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:bg-accent hover:text-foreground md:size-8"
            onClick={onResume}
            title={status === "paused" ? t`恢复传输` : t`重试传输`}
          >
            {status === "paused" ? (
              <Play className="size-4" />
            ) : (
              <RotateCcw className="size-4" />
            )}
          </Button>
        )}
        {status === "completed" && item.savePath && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:bg-accent hover:text-foreground md:size-8"
            onClick={onOpenFolder}
            title={t`打开文件夹`}
          >
            <FolderOpen className="size-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:size-8"
          onClick={onDelete}
          title={t`删除记录`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
