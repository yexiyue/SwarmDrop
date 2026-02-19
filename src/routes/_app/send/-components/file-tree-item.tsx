/**
 * FileTreeItem
 * 文件树中的文件行组件，支持 5 种状态变体
 */

import {
  File,
  FileImage,
  FileText,
  FileCode,
  FileArchive,
  Check,
  Timer,
  X,
  RotateCcw,
} from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import type { FileStatus } from "../-file-tree";

interface FileTreeItemProps {
  name: string;
  size: number;
  variant: FileStatus;
  /** 传输进度 0-100（仅 transferring 用） */
  progress?: number;
  /** 缩进层级 */
  level?: number;
  /** 删除回调（select 模式） */
  onRemove?: () => void;
  /** 重试回调（error 模式） */
  onRetry?: () => void;
}

/** 根据文件名后缀选择图标 */
function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "svg":
    case "webp":
    case "bmp":
    case "ico":
      return FileImage;
    case "md":
    case "txt":
    case "doc":
    case "docx":
    case "pdf":
      return FileText;
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "json":
    case "css":
    case "html":
    case "rs":
    case "py":
    case "go":
    case "java":
    case "toml":
    case "yaml":
    case "yml":
      return FileCode;
    case "zip":
    case "tar":
    case "gz":
    case "rar":
    case "7z":
      return FileArchive;
    default:
      return File;
  }
}

const variantStyles: Record<
  FileStatus,
  {
    row: string;
    icon: string;
    name: string;
    info: string;
  }
> = {
  select: {
    row: "hover:bg-muted/50",
    icon: "text-blue-500",
    name: "text-foreground",
    info: "text-muted-foreground",
  },
  waiting: {
    row: "",
    icon: "text-muted-foreground/60",
    name: "text-muted-foreground",
    info: "text-muted-foreground/60",
  },
  transferring: {
    row: "bg-accent border border-blue-200",
    icon: "text-blue-500",
    name: "text-foreground",
    info: "text-blue-600 font-medium",
  },
  completed: {
    row: "",
    icon: "text-green-500",
    name: "text-foreground",
    info: "text-muted-foreground",
  },
  error: {
    row: "bg-red-50 dark:bg-red-950/20",
    icon: "text-red-500",
    name: "text-foreground",
    info: "text-red-500",
  },
};

export function FileTreeItem({
  name,
  size,
  variant,
  progress = 0,
  level = 0,
  onRemove,
  onRetry,
}: FileTreeItemProps) {
  const styles = variantStyles[variant];
  const Icon = getFileIcon(name);

  if (variant === "transferring") {
    return (
      <div
        className={cn("flex flex-col gap-1 rounded-md px-2 py-1.5", styles.row)}
        style={{ paddingLeft: `${level * 22 + 8}px` }}
      >
        {/* 顶部行：leftGroup + rightGroup */}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Icon className={cn("size-4 shrink-0", styles.icon)} />
            <span className={cn("min-w-0 truncate text-sm", styles.name)}>
              {name}
            </span>
          </div>
          <span className={cn("shrink-0 text-xs", styles.info)}>
            {Math.round(progress)}%
          </span>
        </div>
        {/* 全宽进度条 */}
        <Progress value={progress} className="h-1" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5",
        styles.row,
      )}
      style={{ paddingLeft: `${level * 22 + 8}px` }}
    >
      {/* leftGroup */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Icon className={cn("size-4 shrink-0", styles.icon)} />
        <span className={cn("min-w-0 truncate text-sm", styles.name)}>
          {name}
        </span>
      </div>

      {/* rightGroup */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={cn("text-xs", styles.info)}>
          {variant === "error" ? <Trans>失败</Trans> : formatFileSize(size)}
        </span>
        {variant === "select" && (
          <button
            type="button"
            onClick={onRemove}
            className="cursor-pointer rounded-sm p-0.5 text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        )}
        {variant === "waiting" && (
          <Timer className={cn("size-3.5", styles.info)} />
        )}
        {variant === "completed" && (
          <Check className="size-3.5 text-green-500" />
        )}
        {variant === "error" && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded p-0.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
