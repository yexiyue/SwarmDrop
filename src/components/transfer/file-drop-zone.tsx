/**
 * FileDropZone
 * 文件拖放区 — 拖拽文件/文件夹，或通过按钮选择
 * 移动端：隐藏拖拽提示，突出按钮操作
 */

import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { CloudUpload, FilePlus, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Trans } from "@lingui/react/macro";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-breakpoint";

interface FileDropZoneProps {
  onFilesSelected: (paths: string[]) => void;
  disabled?: boolean;
}

export function FileDropZone({ onFilesSelected, disabled }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const paths: string[] = [];
      const items = e.dataTransfer.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // Tauri 环境下 File 对象带有 path 属性（非标准 Web API）
        const file = item.getAsFile() as (File & { path?: string }) | null;
        if (file?.path) {
          paths.push(file.path);
        }
      }
      if (paths.length > 0) {
        onFilesSelected(paths);
      }
    },
    [disabled, onFilesSelected],
  );

  const handleSelectFiles = async () => {
    const selected = await open({
      multiple: true,
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      onFilesSelected(paths);
    }
  };

  const handleSelectFolder = async () => {
    const selected = await open({
      directory: true,
    });
    if (selected) {
      onFilesSelected([selected]);
    }
  };

  // 移动端：紧凑的按钮式布局
  if (isMobile) {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Button
          variant="outline"
          className="h-12 w-full justify-start gap-3 border-blue-200 bg-blue-50/50 text-foreground hover:bg-blue-50"
          onClick={handleSelectFiles}
          disabled={disabled}
        >
          <FilePlus className="size-5 text-blue-600" />
          <Trans>选择文件</Trans>
        </Button>
        <Button
          variant="outline"
          className="h-12 w-full justify-start gap-3 border-blue-200 bg-blue-50/50 text-foreground hover:bg-blue-50"
          onClick={handleSelectFolder}
          disabled={disabled}
        >
          <FolderPlus className="size-5 text-blue-600" />
          <Trans>选择文件夹</Trans>
        </Button>
      </div>
    );
  }

  // 桌面端：拖拽区 + 按钮
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3.5 rounded-xl border-[1.5px] border-dashed px-4 py-8 transition-colors",
        isDragging
          ? "border-blue-500 bg-blue-100"
          : "border-blue-200 bg-blue-50",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {/* 圆形图标容器 */}
      <div className="flex size-12 items-center justify-center rounded-full bg-blue-100">
        <CloudUpload className="size-6 text-blue-600" />
      </div>

      <span className="text-sm text-muted-foreground">
        <Trans>拖拽文件/文件夹到这里</Trans>
      </span>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSelectFiles}
          disabled={disabled}
        >
          <Trans>选择文件</Trans>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSelectFolder}
          disabled={disabled}
          className="border-blue-400 text-blue-600 hover:bg-blue-50"
        >
          <Trans>选择文件夹</Trans>
        </Button>
      </div>
    </div>
  );
}
