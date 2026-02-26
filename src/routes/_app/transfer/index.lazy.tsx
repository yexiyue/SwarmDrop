/**
 * Transfer Page (Lazy)
 * 传输页面 - 懒加载组件
 * 展示活跃传输和历史记录
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useTransferStore } from "@/stores/transfer-store";
import { TransferItem } from "./-transfer-item";
import type { TransferSession } from "@/commands/transfer";

export const Route = createLazyFileRoute("/_app/transfer/")({
  component: TransferPage,
});

function TransferPage() {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  const sessions = useTransferStore((s) => s.sessions);
  const history = useTransferStore((s) => s.history);

  // 活跃传输（按开始时间倒序）
  const activeSessions = Object.values(sessions).sort(
    (a, b) => b.startedAt - a.startedAt,
  );

  // 全部传输列表 = 活跃 + 历史
  const allSessions = [...activeSessions, ...history];

  const content =
    allSessions.length === 0 ? (
      <EmptyState />
    ) : (
      <TransferList
        activeSessions={activeSessions}
        allSessions={allSessions}
      />
    );

  if (isMobile) {
    return (
      <main className="flex h-full flex-1 flex-col bg-background">
        {/* Mobile Header */}
        <header className="flex h-13 items-center justify-between border-b border-border px-4">
          <h1 className="text-[15px] font-medium text-foreground">
            <Trans>传输</Trans>
          </h1>
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
      </header>

      {/* Page Content */}
      <div className="flex-1 overflow-auto p-5 lg:p-6">{content}</div>
    </main>
  );
}

/* ─────────────────── 传输列表 ─────────────────── */

function TransferList({
  activeSessions,
  allSessions,
}: {
  activeSessions: TransferSession[];
  allSessions: TransferSession[];
}) {
  // 已完成的（不含活跃的）
  const completedSessions = allSessions.filter(
    (s) =>
      s.status === "completed" ||
      s.status === "failed" ||
      s.status === "cancelled",
  );

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

      {/* 最近完成 */}
      {completedSessions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            <Trans>最近完成</Trans>
          </h2>
          <div className="flex flex-col gap-2.5">
            {completedSessions.map((session) => (
              <TransferItem key={session.sessionId} session={session} />
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
