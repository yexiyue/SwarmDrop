/**
 * Transfer Page (Lazy)
 * 传输页面 - 懒加载组件
 * 展示活跃传输和持久化历史记录
 */

import { useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, Trash2 } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useTransferStore } from "@/stores/transfer-store";
import { TransferItem } from "./-transfer-item";
import { HistoryItem } from "./-history-item";
import type {
  TransferSession,
  TransferHistoryItem,
  HistorySessionStatus,
} from "@/commands/transfer";
import { clearTransferHistory } from "@/commands/transfer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export const Route = createLazyFileRoute("/_app/transfer/")({
  component: TransferPage,
});

/** 状态过滤选项 */
const STATUS_FILTERS: {
  value: HistorySessionStatus | "all";
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "paused", label: "已暂停" },
  { value: "cancelled", label: "已取消" },
];

function TransferPage() {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  const sessions = useTransferStore((s) => s.sessions);
  const dbHistory = useTransferStore((s) => s.dbHistory);
  const loadHistory = useTransferStore((s) => s.loadHistory);

  const [statusFilter, setStatusFilter] = useState<
    HistorySessionStatus | "all"
  >("all");

  // 活跃传输（按开始时间倒序）
  const activeSessions = Object.values(sessions).sort(
    (a, b) => b.startedAt - a.startedAt,
  );

  // 过滤 DB 历史
  const filteredHistory =
    statusFilter === "all"
      ? dbHistory
      : dbHistory.filter((item) => item.status === statusFilter);

  const hasContent = activeSessions.length > 0 || filteredHistory.length > 0;

  const handleClearHistory = async () => {
    try {
      await clearTransferHistory();
      await loadHistory();
      toast.success("已清空传输历史");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const content = !hasContent ? (
    <EmptyState />
  ) : (
    <TransferList
      activeSessions={activeSessions}
      historyItems={filteredHistory}
    />
  );

  // 工具栏右侧操作区
  const toolbarActions = dbHistory.length > 0 && (
    <div className="flex items-center gap-2">
      {/* 状态过滤 */}
      <select
        className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
        value={statusFilter}
        onChange={(e) =>
          setStatusFilter(e.target.value as HistorySessionStatus | "all")
        }
      >
        {STATUS_FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      {/* 清空历史 */}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
        onClick={handleClearHistory}
      >
        <Trash2 className="size-3" />
        <Trans>清空</Trans>
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <main className="flex h-full flex-1 flex-col bg-background">
        {/* Mobile Header */}
        <header className="flex h-13 items-center justify-between border-b border-border px-4">
          <h1 className="text-[15px] font-medium text-foreground">
            <Trans>传输</Trans>
          </h1>
          {toolbarActions}
        </header>
        <div className="flex-1 overflow-auto px-4 py-4">{content}</div>
      </main>
    );
  }

  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      {/* Toolbar */}
      <header className="flex h-13 items-center justify-between border-b border-border px-4 lg:px-5">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-medium text-foreground">
            <Trans>传输</Trans>
          </h1>
        </div>
        {toolbarActions}
      </header>

      {/* Page Content */}
      <div className="flex-1 overflow-auto p-5 lg:p-6">{content}</div>
    </main>
  );
}

/* ─────────────────── 传输列表 ─────────────────── */

function TransferList({
  activeSessions,
  historyItems,
}: {
  activeSessions: TransferSession[];
  historyItems: TransferHistoryItem[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* 活跃传输 */}
      {activeSessions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            <Trans>活跃传输</Trans>
          </h2>
          <div className="flex flex-col gap-2.5">
            {activeSessions.map((session) => (
              <TransferItem key={session.sessionId} session={session} />
            ))}
          </div>
        </section>
      )}

      {/* 传输历史（从 DB 加载） */}
      {historyItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            <Trans>传输历史</Trans>
          </h2>
          <div className="flex flex-col gap-2.5">
            {historyItems.map((item) => (
              <HistoryItem key={item.sessionId} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ─────────────────── 空状态 ─────────────────── */

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <ArrowLeftRight className="size-7 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          <Trans>暂无传输记录</Trans>
        </p>
        <p className="text-xs text-muted-foreground">
          <Trans>在设备页面选择已配对设备发送文件</Trans>
        </p>
      </div>
    </div>
  );
}
