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
} from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTransferStore } from "@/stores/transfer-store";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { formatFileSize, formatSpeed, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openFolder, openFile, revealFile, isAndroid } from "@/lib/file-picker";
import { join } from "@tauri-apps/api/path";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { cancelSend, cancelReceive } from "@/commands/transfer";
import { FileTree } from "../send/-components/file-tree";
import { buildTreeDataFromSession } from "../send/-file-tree";
import type { TransferSession } from "@/commands/transfer";

export const Route = createLazyFileRoute("/_app/transfer/$sessionId")({
  component: TransferDetailPage,
});

// 静态配置对象 - 避免每次渲染重新创建
const STATUS_CONFIG = {
  pending: { label: "等待中", className: "bg-gray-100 text-gray-600" },
  waiting_accept: {
    label: "等待确认",
    className: "bg-yellow-100 text-yellow-600",
  },
  transferring: { label: "传输中", className: "bg-blue-100 text-blue-600" },
  completed: { label: "已完成", className: "bg-green-100 text-green-600" },
  failed: { label: "失败", className: "bg-red-100 text-red-600" },
  cancelled: { label: "已取消", className: "bg-gray-100 text-gray-600" },
} as const;

function TransferDetailPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // 使用细粒度选择器，只订阅需要的 state
  const session = useTransferStore(
    useCallback(
      (s) =>
        s.sessions[sessionId] ??
        s.history.find((h) => h.sessionId === sessionId),
      [sessionId],
    ),
  );

  const handleBack = useCallback(() => {
    void navigate({ to: "/transfer" });
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

  if (isMobile) {
    return <MobileTransferDetailView session={session} onBack={handleBack} />;
  }

  return <DesktopTransferDetailView session={session} onBack={handleBack} />;
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
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      <Trans>{config.label}</Trans>
    </span>
  );
});

const TransferProgress = memo(function TransferProgress({
  session,
}: {
  session: TransferSession;
}) {
  const progressPercent = useMemo(() => {
    if (!session.progress) return 0;
    return Math.round(
      (session.progress.transferredBytes / session.progress.totalBytes) * 100,
    );
  }, [session.progress]);

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

  const handleCancel = useCallback(async () => {
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
    if (!session.savePath) return;

    try {
      if (isAndroid()) {
        // Android：直接打开文件（无法打开私有目录）
        const file = session.files[0];
        if (file) {
          const filePath = await join(session.savePath, file.relativePath);
          await openFile(filePath);
        }
      } else if (session.files.length === 1) {
        const file = session.files[0];
        const filePath = await join(session.savePath, file.relativePath);
        await revealFile(filePath, session.savePath);
      } else {
        await openFolder(session.savePath);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [session.savePath, session.files]);

  if (isActive) {
    return (
      <Button
        variant="outline"
        onClick={handleCancel}
        className="w-full"
      >
        <X className="mr-2 size-4" />
        <Trans>取消传输</Trans>
      </Button>
    );
  }

  if (session.status === "completed" && session.savePath) {
    return (
      <Button onClick={handleOpenFolder} className="w-full">
        <FolderOpen className="mr-2 size-4" />
        {isAndroid() ? <Trans>查看文件</Trans> : <Trans>打开文件夹</Trans>}
      </Button>
    );
  }

  return null;
});

/* ─────────────────── 移动端视图 ─────────────────── */

const MobileTransferDetailView = memo(function MobileTransferDetailView({
  session,
  onBack,
}: {
  session: TransferSession;
  onBack: () => void;
}) {
  const treeData = useMemo(() => {
    return buildTreeDataFromSession(session);
  }, [session]);

  return (
    <main className="flex h-full flex-col bg-background">
      {/* 头部 */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-foreground">
            <Trans>传输详情</Trans>
          </h1>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="flex flex-col gap-5">
          <TransferStatusHeader session={session} />

          <TransferProgress session={session} />

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              <Trans>传输详情</Trans>
            </h3>
            <FileTree
              mode="select"
              dataLoader={treeData.dataLoader}
              rootChildren={treeData.rootChildren}
              totalCount={session.files.length}
              totalSize={session.totalSize}
            />
          </div>
        </div>
      </div>

      {/* 底部操作 */}
      <div className="border-t border-border px-4 py-3">
        <TransferActions session={session} />
      </div>
    </main>
  );
});

/* ─────────────────── 桌面端视图 ─────────────────── */

const DesktopTransferDetailView = memo(function DesktopTransferDetailView({
  session,
  onBack,
}: {
  session: TransferSession;
  onBack: () => void;
}) {
  const treeData = useMemo(() => {
    return buildTreeDataFromSession(session);
  }, [session]);

  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      {/* Toolbar */}
      <header className="flex h-13 items-center gap-2 border-b border-border px-4 lg:px-5">
        <button
          type="button"
          onClick={onBack}
          className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-[15px] font-medium text-foreground">
          <Trans>传输详情</Trans>
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5 lg:p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <TransferStatusHeader session={session} />

          <TransferProgress session={session} />

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              <Trans>传输详情</Trans>
            </h3>
            <FileTree
              mode="select"
              dataLoader={treeData.dataLoader}
              rootChildren={treeData.rootChildren}
              totalCount={session.files.length}
              totalSize={session.totalSize}
            />
          </div>

          <div className="flex justify-end">
            <TransferActions session={session} />
          </div>
        </div>
      </div>
    </main>
  );
});
