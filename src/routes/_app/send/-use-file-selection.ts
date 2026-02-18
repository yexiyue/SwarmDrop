/**
 * useFileSelection
 * 文件选择状态管理 Hook — 管理 entries Map + entryPoints，
 * 返回 headless-tree 所需的 dataLoader / rootChildren / 统计数据
 */

import { useCallback, useMemo, useState } from "react";
import { buildTreeData } from "./-file-tree";
import type {
  FileMeta,
  EntryPoint,
  TreeDataLoader,
} from "./-file-tree";
import { listFiles, getFileMeta } from "@/commands/transfer";

export interface FileSelection {
  /** headless-tree 数据加载器 */
  dataLoader: TreeDataLoader;
  /** 根级子节点 ID */
  rootChildren: string[];
  /** 文件总数 */
  totalCount: number;
  /** 总大小 */
  totalSize: number;
  /** 是否有文件 */
  hasFiles: boolean;
  /** 添加路径（文件或文件夹） */
  addPaths: (paths: string[]) => Promise<void>;
  /** 移除文件 */
  removePath: (absolutePath: string) => void;
  /** 清空所有 */
  clear: () => void;
  /** 获取所有文件的绝对路径列表 */
  getFilePaths: () => string[];
}

export function useFileSelection(): FileSelection {
  const [entries, setEntries] = useState<Map<string, FileMeta>>(() => new Map());
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);

  // 派生树数据
  const treeData = useMemo(
    () => buildTreeData(entries, entryPoints),
    [entries, entryPoints],
  );

  // 统计
  const stats = useMemo(() => {
    let totalSize = 0;
    let totalCount = 0;
    for (const [, meta] of entries) {
      totalSize += meta.size;
      totalCount++;
    }
    return { totalSize, totalCount };
  }, [entries]);

  const addPaths = useCallback(
    async (paths: string[]) => {
      const newEntries = new Map<string, FileMeta>();
      const newEntryPoints: EntryPoint[] = [];

      for (const path of paths) {
        try {
          const result = await listFiles(path);

          if (result.isDirectory) {
            // 目录
            newEntryPoints.push({ path, type: "folder" });
            for (const file of result.entries) {
              newEntries.set(file.path, {
                absolutePath: file.path,
                name: file.name,
                size: file.size,
              });
            }
          } else {
            // 单个文件
            const file = result.entries[0];
            newEntryPoints.push({ path, type: "file" });
            newEntries.set(file.path, {
              absolutePath: file.path,
              name: file.name,
              size: file.size,
            });
          }
        } catch {
          // 回退：尝试用 getFileMeta 获取单个文件信息
          try {
            const metas = await getFileMeta([path]);
            for (const meta of metas) {
              newEntryPoints.push({ path, type: "file" });
              newEntries.set(meta.path, {
                absolutePath: meta.path,
                name: meta.name,
                size: meta.size,
              });
            }
          } catch {
            // 无法获取信息，跳过
          }
        }
      }

      setEntries((prev) => {
        const merged = new Map(prev);
        for (const [key, value] of newEntries) {
          merged.set(key, value);
        }
        return merged;
      });

      setEntryPoints((prev) => [...prev, ...newEntryPoints]);
    },
    [],
  );

  const removePath = useCallback(
    (absolutePath: string) => {
      setEntries((prev) => {
        const next = new Map(prev);
        // 移除该路径（可能是文件或文件夹下所有文件）
        const normalizedPath = absolutePath.replace(/\\/g, "/");
        for (const key of next.keys()) {
          const normalizedKey = key.replace(/\\/g, "/");
          if (
            normalizedKey === normalizedPath ||
            normalizedKey.startsWith(`${normalizedPath}/`)
          ) {
            next.delete(key);
          }
        }
        return next;
      });

      // 清理对应的 entryPoint
      setEntryPoints((prev) => {
        const normalizedPath = absolutePath.replace(/\\/g, "/");
        return prev.filter((ep) => {
          const normalizedEp = ep.path.replace(/\\/g, "/");
          return normalizedEp !== normalizedPath;
        });
      });
    },
    [],
  );

  const clear = useCallback(() => {
    setEntries(new Map());
    setEntryPoints([]);
  }, []);

  const getFilePaths = useCallback((): string[] => {
    const paths: string[] = [];
    for (const [, meta] of entries) {
      paths.push(meta.absolutePath);
    }
    return paths;
  }, [entries]);

  return {
    dataLoader: treeData.dataLoader,
    rootChildren: treeData.rootChildren,
    totalCount: stats.totalCount,
    totalSize: stats.totalSize,
    hasFiles: stats.totalCount > 0,
    addPaths,
    removePath,
    clear,
    getFilePaths,
  };
}
