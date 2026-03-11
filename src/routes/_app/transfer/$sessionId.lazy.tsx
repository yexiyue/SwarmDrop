/**
 * Transfer Detail Page (Lazy)
 * 传输详情页面 - 展示传输进度、文件树、统计信息
 */

import { useMemo, memo, useCallback } from "react";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  Loader2,
  X,
  Pause,
} from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTransferStore } from "@/stores/transfer-store";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { formatFileSize, formatSpeed, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openTransferResult } from "@/lib/file-picker";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { cancelSend, cancelReceive, pauseTransfer } from "@/commands/transfer";
import { FileTree } from "../send/-components/file-tree";
import { buildTreeDataFromSession } from "../send/-file-tree";
import type { TransferSession, TransferHistoryItem } from "@/commands/transfer";

export const Route = createLazyFileRoute("/_app/transfer/$sessionId")({
  component: TransferDetailPage,
});

// className 静态配置 - 不含 i18n 文本
const STATUS_CLASSNAMES: Record<TransferSession["status"], string> = {
  pending: "bg-gray-100 text-gray-600",
  waiting_accept: "bg-yellow-100 text-yellow-600",
  transferring: "bg-blue-100 text-blue-600",
  completed: "bg-green-100 text-green-600",
  failed: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-600",
};

/** 将 DB 历史记录映射为 TransferSession 形状（供详情页组件复用） */
function historyToSession(item: TransferHistoryItem): TransferSession {
  return {
    sessionId: item.sessionId,
    direction: item.direction,
    peerId: item.peerId,
    deviceName: item.peerName,
    files: item.files.map((f) => ({
      fileId: f.fileId,
      name: f.name,
      relativePath: f.relativePath,
      size: f.size,
      isDirectory: false,
    })),
    totalSize: item.totalSize,
    status: item.status as TransferSession["status"],
    progress: null,
    error: item.errorMessage,
    startedAt: item.startedAt,
    completedAt: item.finishedAt,
    saveLocation: item.savePath ?? undefined,
  };
}

function TransferDetailPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // 拆分 selector：分别订阅原始数据，避免 historyToSession 每次创建新对象
  const activeSession = useTransferStore(
    useCallback((s) => s.sessions[sessionId], [sessionId]),
  );
  const historyItem = useTransferStore(
    useCallback(
      (s) =>
        s.sessions[sessionId]
          ? undefined
          : s.dbHistory.find((h) => h.sessionId === sessionId),
      [sessionId],
    ),
  );
  const session = useMemo(
    () => activeSession ?? (historyItem ? historyToSession(historyItem) : undefined),
    [activeSession, historyItem],
  );

  const handleBack = useCallback(() => {
    navigate({ to: "/transfer" });
  }, [navigate]);

  if (!session) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">
          <Trans>传输记录不存在</Trans>
        </p>
        <Button variant="outline" onClick={handleBack}>
          <Trans>返回</Trans>
        </Button>
      </main>
    );
  }

  return (
    <TransferDetailContent
      session={session}
      onBack={handleBack}
      isMobile={isMobile}
    />
  );
}

/* ─────────────────── 共享组件 ─────────────────── */

const TransferStatusHeader = memo(function TransferStatusHeader({
  session,
}: {
  session: TransferSession;
}) {
  const isSend = session.direction === "send";
  const isActive =
    session.status === "pending" ||
    session.status === "waiting_accept" ||
    session.status === "transferring";

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-full",
          isSend ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600",
        )}
      >
        {isSend ? (
          <ArrowUp className="size-5" />
        ) : (
          <ArrowDown className="size-5" />
        )}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {isSend ? (
            <Trans>发送到 {session.deviceName}</Trans>
          ) : (
            <Trans>来自 {session.deviceName}</Trans>
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          {session.files.length} <Trans>个文件</Trans> ·{" "}
          {formatFileSize(session.totalSize)}
        </p>
      </div>
      {isActive && <StatusBadge status={session.status} />}
    </div>
  );
});

const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: TransferSession["status"];
}) {
  const labels: Record<TransferSession["status"], string> = {
    pending: t`等待中`,
    waiting_accept: t`等待确认`,
    transferring: t`传输中`,
    completed: t`已完成`,
    failed: t`失败`,
    cancelled: t`已取消`,
  };

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASSNAMES[status],
      )}
    >
      {labels[status]}
    </span>
  );
});

const TransferProgress = memo(function TransferProgress({
  session,
}: {
  session: TransferSession;
}) {
  const progressPercent =
    session.progress && session.progress.totalBytes > 0
      ? Math.round(
          (session.progress.transferredBytes / session.progress.totalBytes) *
            100,
        )
      : 0;

  if (session.status === "transferring" && session.progress) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-3xl font-bold text-foreground">
            {progressPercent}%
          </span>
          <span className="text-sm text-muted-foreground">
            {formatSpeed(session.progress.speed)}
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {formatFileSize(session.progress.transferredBytes)} /{" "}
            {formatFileSize(session.progress.totalBytes)}
          </span>
          {session.progress.eta != null && (
            <span>
              <Trans>剩余 {formatDuration(session.progress.eta)}</Trans>
            </span>
          )}
        </div>
      </div>
    );
  }

  if (session.status === "completed") {
    const duration = session.completedAt
      ? Math.round((session.completedAt - session.startedAt) / 1000)
      : 0;

    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="size-10 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">
          <Trans>所有文件传输完成！</Trans>
        </h3>

        <div className="flex w-full justify-center gap-12">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-foreground">
              {session.files.length}
            </span>
            <span className="text-xs text-muted-foreground">
              <Trans>文件</Trans>
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-foreground">
              {formatFileSize(session.totalSize)}
            </span>
            <span className="text-xs text-muted-foreground">
              <Trans>总大小</Trans>
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-foreground">
              {formatDuration(duration)}
            </span>
            <span className="text-xs text-muted-foreground">
              <Trans>用时</Trans>
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (session.status === "failed") {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-red-100">
          <XCircle className="size-10 text-red-600" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">
          <Trans>传输失败</Trans>
        </h3>
        {session.error && (
          <p className="text-sm text-muted-foreground">{session.error}</p>
        )}
      </div>
    );
  }

  if (session.status === "waiting_accept") {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          <Trans>等待对方确认...</Trans>
        </p>
      </div>
    );
  }

  return null;
});

const TransferActions = memo(function TransferActions({
  session,
}: {
  session: TransferSession;
}) {
  const isSend = session.direction === "send";
  const isActive =
    session.status === "pending" ||
    session.status === "waiting_accept" ||
    session.status === "transferring";

  const handlePause = useCallback(async () => {
    useTransferStore.getState().cancelSession(session.sessionId);
    try {
      await pauseTransfer(session.sessionId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [session.sessionId]);

  const handleCancel = useCallback(async () => {
    useTransferStore.getState().cancelSession(session.sessionId);
    try {
      if (isSend) {
        await cancelSend(session.sessionId);
      } else {
        await cancelReceive(session.sessionId);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [isSend, session.sessionId]);

  const handleOpenFolder = useCallback(async () => {
    try {
      await openTransferResult(session);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [session]);

  if (isActive) {
    return (
      <div className="flex w-full gap-2">
        {session.status === "transferring" && (
          <Button
            variant="secondary"
            onClick={handlePause}
            className="flex-1"
          >
            <Pause className="mr-2 size-4" />
            <Trans>暂停传输</Trans>
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleCancel}
          className="flex-1"
        >
          <X className="mr-2 size-4" />
          <Trans>取消传输</Trans>
        </Button>
      </div>
    );
  }

  if (session.status === "completed" && session.saveLocation) {
    return (
      <Button onClick={handleOpenFolder} className="w-full">
        <FolderOpen className="mr-2 size-4" />
        <Trans>打开文件夹</Trans>
      </Button>
    );
  }

  return null;
});

/* ─────────────────── 统一详情视图 ─────────────────── */

const TransferDetailContent = memo(function TransferDetailContent({
  session,
  onBack,
  isMobile,
}: {
  session: TransferSession;
  onBack: () => void;
  isMobile: boolean;
}) {
  const treeData = useMemo(() => {
    return buildTreeDataFromSession(session);
  }, [session]);

  return (
    <main className={cn("flex h-full flex-col bg-background", !isMobile && "flex-1")}>
      {/* 头部 */}
      <header
        className={cn(
          "flex items-center border-b border-border",
          isMobile ? "gap-3 px-4 py-3" : "h-13 gap-2 px-4 lg:px-5",
        )}
      >
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "flex items-center justify-center",
            isMobile
              ? "size-9 rounded-full hover:bg-muted"
              : "size-8 rounded-md hover:bg-muted",
          )}
        >
          <ArrowLeft className={isMobile ? "size-5" : "size-4"} />
        </button>
        {isMobile ? (
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground">
              <Trans>传输详情</Trans>
            </h1>
          </div>
        ) : (
          <h1 className="text-[15px] font-medium text-foreground">
            <Trans>传输详情</Trans>
          </h1>
        )}
      </header>

      {/* 内容 */}
      <div className={cn("flex-1 overflow-auto", isMobile ? "px-4 py-4" : "p-5 lg:p-6")}>
        <div className={cn("flex flex-col", isMobile ? "gap-5" : "mx-auto max-w-2xl gap-6")}>
          <TransferStatusHeader session={session} />

          <TransferProgress session={session} />

          <div className={cn("flex flex-col", isMobile ? "gap-2" : "gap-3")}>
            <h3 className="text-sm font-semibold text-foreground">
              <Trans>传输详情</Trans>
            </h3>
            <FileTree
              mode={session.status === "transferring" ? "transfer" : "select"}
              dataLoader={treeData.dataLoader}
              rootChildren={treeData.rootChildren}
              totalCount={session.files.length}
              totalSize={session.totalSize}
              progress={session.progress}
            />
          </div>

          {!isMobile && (
            <div className="flex justify-end">
              <TransferActions session={session} />
            </div>
          )}
        </div>
      </div>

      {/* 移动端底部操作栏 */}
      {isMobile && (
        <div className="border-t border-border px-4 py-3">
          <TransferActions session={session} />
        </div>
      )}
    </main>
  );
});
