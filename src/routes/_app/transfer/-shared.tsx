/**
 * Transfer 共享组件和工具函数
 * 在 TransferItem、HistoryItem、详情页之间复用
 */

import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransferStatus } from "@/commands/transfer";

export type { TransferStatus };

/* ─── 方向图标 ─── */

export function DirectionIcon({ isSend }: { isSend: boolean }) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg md:size-10 md:rounded-xl",
        isSend
          ? "bg-blue-50 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400"
          : "bg-green-50 text-green-500 dark:bg-green-500/15 dark:text-green-400",
      )}
    >
      {isSend ? (
        <ArrowUpRight className="size-4 md:size-4.5" strokeWidth={2.5} />
      ) : (
        <ArrowDownLeft className="size-4 md:size-4.5" strokeWidth={2.5} />
      )}
    </div>
  );
}

/* ─── 卡片容器 ─── */

const CARD_BASE =
  "group relative flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/40 hover:shadow-sm md:gap-3 md:p-3.5";

export function TransferCard({
  onClick,
  alignItems = "center",
  children,
}: {
  onClick: () => void;
  alignItems?: "start" | "center";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(CARD_BASE, alignItems === "start" && "items-start md:items-start")}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      {children}
    </div>
  );
}

/* ─── 工具函数 ─── */

/** 计算传输进度百分比 */
export function calcPercent(transferred: number, total: number): number {
  return total > 0 ? Math.round((transferred / total) * 100) : 0;
}

/** 判断传输是否处于活跃状态 */
export function isActiveStatus(status: TransferStatus): boolean {
  return (
    status === "pending" ||
    status === "waiting_accept" ||
    status === "transferring"
  );
}

/** 操作按钮通用样式 */
export const ACTION_BTN_CLASS =
  "size-7 text-muted-foreground hover:bg-accent hover:text-foreground md:size-8";
export const DESTRUCTIVE_BTN_CLASS =
  "size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:size-8";
