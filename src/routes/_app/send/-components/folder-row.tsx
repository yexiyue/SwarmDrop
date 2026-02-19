/**
 * FolderRow
 * 文件树中的文件夹行组件，支持展开/折叠
 */

import { ChevronRight, ChevronDown, Folder, FolderOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Trans } from "@lingui/react/macro";
import { formatFileSize } from "@/lib/format";

interface FolderRowProps {
  name: string;
  /** 是否展开 */
  isExpanded: boolean;
  /** 文件夹内文件数量 */
  fileCount: number;
  /** 文件夹总大小 */
  totalSize: number;
  /** 缩进层级 */
  level?: number;
  /** 模式 */
  mode: "select" | "transfer";
  /** 切换展开/折叠 */
  onToggle: () => void;
  /** 删除回调（select 模式） */
  onRemove?: () => void;
}

export function FolderRow({
  name,
  isExpanded,
  fileCount,
  totalSize,
  level = 0,
  mode,
  onToggle,
  onRemove,
}: FolderRowProps) {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const FolderIcon = isExpanded ? FolderOpen : Folder;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer",
        isExpanded ? "bg-accent" : "hover:bg-muted/50",
      )}
      style={{ paddingLeft: `${level * 22 + 8}px` }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {/* leftGroup */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ChevronIcon className="size-4 shrink-0 text-muted-foreground" />
        <FolderIcon className="size-4 shrink-0 text-amber-500" />
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {name}
        </span>
      </div>

      {/* rightGroup */}
      <div
        className="flex shrink-0 items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "select" && (
          <>
            <span className="text-xs text-muted-foreground">
              <Trans>{fileCount} 项</Trans>
              {" · "}
              {formatFileSize(totalSize)}
            </span>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="cursor-pointer rounded-sm p-0.5 text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            )}
          </>
        )}

        {mode === "transfer" && (
          <span className="text-xs text-muted-foreground">
            <Trans>{fileCount} 项</Trans>
          </span>
        )}
      </div>
    </div>
  );
}
