/**
 * FileList
 * 已选文件列表 — 显示文件名、大小，支持移除
 */

import { File, Folder, X } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { formatFileSize } from "@/lib/format";

export interface SelectedFile {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
}

interface FileListProps {
  files: SelectedFile[];
  onRemove: (index: number) => void;
}

export function FileList({ files, onRemove }: FileListProps) {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="flex flex-col gap-2">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          <Trans>已选文件</Trans>
        </h3>
      </div>

      {/* 文件列表 */}
      <div className="flex max-h-48 flex-col gap-1 overflow-auto">
        {files.map((file, index) => (
          <div
            key={`${file.path}-${index}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
          >
            {file.isDirectory ? (
              <Folder className="size-4 shrink-0 text-blue-500" />
            ) : (
              <File className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {file.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* 统计 */}
      <div className="text-xs text-muted-foreground">
        <Trans>
          共 {files.length} 项 · {formatFileSize(totalSize)}
        </Trans>
      </div>
    </div>
  );
}
