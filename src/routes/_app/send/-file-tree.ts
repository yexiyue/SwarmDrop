/**
 * 文件树工具函数和类型定义
 * 将扁平文件列表转为 headless-tree 所需的 dataLoader 格式
 */

/** 文件状态（用于传输模式） */
export type FileStatus =
  | "select"
  | "waiting"
  | "transferring"
  | "completed"
  | "error";

/** 树节点数据 */
export interface TreeNodeData {
  /** 节点 ID（= relativePath，目录以 / 结尾） */
  id: string;
  /** 显示名称 */
  name: string;
  /** 类型 */
  type: "file" | "directory";
  /** 完整相对路径 */
  path: string;
  /** 文件大小（文件节点），目录为子文件累计大小 */
  size: number;
  /** 文件标识符（仅文件，传输协议用） */
  fileId?: number;
  /** 目录下的文件数量（仅目录节点，buildTreeData 中预计算） */
  fileCount?: number;
  /** 绝对路径（用于删除操作） */
  absolutePath?: string;
}

/** 文件元信息（内部存储用） */
export interface FileMeta {
  absolutePath: string;
  name: string;
  size: number;
}

/** 入口点（用户选择的路径） */
export interface EntryPoint {
  path: string;
  type: "file" | "folder";
}

/** headless-tree 的 dataLoader */
export interface TreeDataLoader {
  getItem: (itemId: string) => TreeNodeData;
  getChildren: (itemId: string) => string[];
}

/** buildTreeData 返回值 */
export interface TreeData {
  dataLoader: TreeDataLoader;
  rootChildren: string[];
}

/**
 * 从扁平的文件条目构建 headless-tree 所需的 dataLoader
 *
 * @param entries 文件条目 Map（absolutePath → FileMeta）
 * @param entryPoints 用户选择的入口点
 * @returns dataLoader + rootChildren
 */
export function buildTreeData(
  entries: Map<string, FileMeta>,
  entryPoints: EntryPoint[],
): TreeData {
  const nodeMap = new Map<string, TreeNodeData>();
  const childrenMap = new Map<string, string[]>();
  const rootChildren: string[] = [];

  // 先计算每个文件的 relativePath
  const fileEntries: { meta: FileMeta; relativePath: string }[] = [];

  for (const [, meta] of entries) {
    const relativePath = computeRelativePath(meta.absolutePath, entryPoints);
    fileEntries.push({ meta, relativePath });
  }

  // 排序：按 relativePath 字母序
  fileEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  // 构建节点和父子关系
  for (const { meta, relativePath } of fileEntries) {
    // 创建文件节点
    const fileId = relativePath;
    nodeMap.set(fileId, {
      id: fileId,
      name: meta.name,
      type: "file",
      path: relativePath,
      size: meta.size,
      absolutePath: meta.absolutePath,
    });

    // 创建中间目录节点
    const parts = relativePath.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length - 1; i++) {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const dirId = `${currentPath}/`;

      if (!nodeMap.has(dirId)) {
        // 从当前文件的绝对路径推算目录的绝对路径
        const normalizedAbsPath = meta.absolutePath.replace(/\\/g, "/");
        const dirAbsolutePath = normalizedAbsPath.endsWith(relativePath)
          ? normalizedAbsPath.slice(0, -relativePath.length) + currentPath
          : undefined;

        nodeMap.set(dirId, {
          id: dirId,
          name: parts[i],
          type: "directory",
          path: dirId,
          size: 0,
          absolutePath: dirAbsolutePath,
        });

        // 将目录添加到父级的 children
        const parentId = parentPath ? `${parentPath}/` : "root";
        const siblings = childrenMap.get(parentId) ?? [];
        siblings.push(dirId);
        childrenMap.set(parentId, siblings);
      }

      // 累加目录大小
      const dirNode = nodeMap.get(dirId)!;
      dirNode.size += meta.size;
    }

    // 将文件添加到其父级的 children
    const parentDir =
      parts.length > 1 ? `${parts.slice(0, -1).join("/")}/` : "root";
    const siblings = childrenMap.get(parentDir) ?? [];
    siblings.push(fileId);
    childrenMap.set(parentDir, siblings);
  }

  // 排序每个目录的 children：目录在前、文件在后，同类按名称排序
  for (const [, children] of childrenMap) {
    children.sort((a, b) => {
      const aIsDir = a.endsWith("/");
      const bIsDir = b.endsWith("/");
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      const aNode = nodeMap.get(a)!;
      const bNode = nodeMap.get(b)!;
      return aNode.name.localeCompare(bNode.name);
    });
  }

  // 预计算每个目录的文件数量
  function computeFileCount(nodeId: string): number {
    const children = childrenMap.get(nodeId) ?? [];
    let count = 0;
    for (const childId of children) {
      const child = nodeMap.get(childId);
      if (child?.type === "directory") {
        const childCount = computeFileCount(childId);
        child.fileCount = childCount;
        count += childCount;
      } else {
        count++;
      }
    }
    return count;
  }

  // 从 root 开始递归计算
  for (const rootId of childrenMap.get("root") ?? []) {
    const node = nodeMap.get(rootId);
    if (node?.type === "directory") {
      node.fileCount = computeFileCount(rootId);
    }
  }

  // 提取根级 children
  rootChildren.push(...(childrenMap.get("root") ?? []));

  // 创建根节点
  const totalSize = fileEntries.reduce((sum, e) => sum + e.meta.size, 0);
  nodeMap.set("root", {
    id: "root",
    name: "root",
    type: "directory",
    path: "",
    size: totalSize,
  });

  const dataLoader: TreeDataLoader = {
    getItem: (itemId: string) => {
      const node = nodeMap.get(itemId);
      if (!node) {
        return {
          id: itemId,
          name: itemId,
          type: "file" as const,
          path: itemId,
          size: 0,
        };
      }
      return node;
    },
    getChildren: (itemId: string) => childrenMap.get(itemId) ?? [],
  };

  return { dataLoader, rootChildren };
}

/**
 * 从 Offer 的文件列表构建 headless-tree 所需的 dataLoader
 *
 * 与 buildTreeData 不同，这里的输入已经包含 relativePath 和 fileId，
 * 不需要 entryPoints 和 absolutePath。
 *
 * @param files Offer 中的文件信息列表
 * @returns dataLoader + rootChildren
 */
export function buildTreeDataFromOffer(
  files: { fileId: number; name: string; relativePath: string; size: number }[],
): TreeData {
  const nodeMap = new Map<string, TreeNodeData>();
  const childrenMap = new Map<string, string[]>();

  // 按 relativePath 排序
  const sorted = [...files].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  );

  for (const file of sorted) {
    const relativePath = file.relativePath;
    const fileId = relativePath;

    // 创建文件节点
    nodeMap.set(fileId, {
      id: fileId,
      name: file.name,
      type: "file",
      path: relativePath,
      size: file.size,
      fileId: file.fileId,
    });

    // 创建中间目录节点
    const parts = relativePath.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length - 1; i++) {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const dirId = `${currentPath}/`;

      if (!nodeMap.has(dirId)) {
        nodeMap.set(dirId, {
          id: dirId,
          name: parts[i],
          type: "directory",
          path: dirId,
          size: 0,
        });

        const parentId = parentPath ? `${parentPath}/` : "root";
        const siblings = childrenMap.get(parentId) ?? [];
        siblings.push(dirId);
        childrenMap.set(parentId, siblings);
      }

      // 累加目录大小
      const dirNode = nodeMap.get(dirId)!;
      dirNode.size += file.size;
    }

    // 将文件添加到父级
    const parentDir =
      parts.length > 1 ? `${parts.slice(0, -1).join("/")}/` : "root";
    const siblings = childrenMap.get(parentDir) ?? [];
    siblings.push(fileId);
    childrenMap.set(parentDir, siblings);
  }

  // 排序每个目录的 children：目录在前、文件在后
  for (const [, children] of childrenMap) {
    children.sort((a, b) => {
      const aIsDir = a.endsWith("/");
      const bIsDir = b.endsWith("/");
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      const aNode = nodeMap.get(a)!;
      const bNode = nodeMap.get(b)!;
      return aNode.name.localeCompare(bNode.name);
    });
  }

  // 预计算每个目录的文件数量
  function computeFileCount(nodeId: string): number {
    const children = childrenMap.get(nodeId) ?? [];
    let count = 0;
    for (const childId of children) {
      const child = nodeMap.get(childId);
      if (child?.type === "directory") {
        const childCount = computeFileCount(childId);
        child.fileCount = childCount;
        count += childCount;
      } else {
        count++;
      }
    }
    return count;
  }

  const rootChildren = childrenMap.get("root") ?? [];
  for (const rootId of rootChildren) {
    const node = nodeMap.get(rootId);
    if (node?.type === "directory") {
      node.fileCount = computeFileCount(rootId);
    }
  }

  // 创建根节点
  const totalSize = sorted.reduce((sum, f) => sum + f.size, 0);
  nodeMap.set("root", {
    id: "root",
    name: "root",
    type: "directory",
    path: "",
    size: totalSize,
  });

  const dataLoader: TreeDataLoader = {
    getItem: (itemId: string) => {
      const node = nodeMap.get(itemId);
      if (!node) {
        return {
          id: itemId,
          name: itemId,
          type: "file" as const,
          path: itemId,
          size: 0,
        };
      }
      return node;
    },
    getChildren: (itemId: string) => childrenMap.get(itemId) ?? [],
  };

  return { dataLoader, rootChildren };
}

/**
 * 计算文件的相对路径
 *
 * 规则：
 * - 如果文件属于某个 folder EntryPoint → folderName/相对路径
 * - 如果文件是独立的 file EntryPoint → basename
 */
export function computeRelativePath(
  absolutePath: string,
  entryPoints: EntryPoint[],
): string {
  // 标准化路径分隔符
  const normalizedPath = absolutePath.replace(/\\/g, "/");

  // 优先匹配 folder EntryPoint
  for (const ep of entryPoints) {
    if (ep.type !== "folder") continue;
    const normalizedEp = ep.path.replace(/\\/g, "/");
    // 确保 ep 路径以 / 结尾用于前缀匹配
    const epPrefix = normalizedEp.endsWith("/")
      ? normalizedEp
      : `${normalizedEp}/`;

    if (normalizedPath.startsWith(epPrefix)) {
      // 提取文件夹名称
      const folderName = normalizedEp.split("/").filter(Boolean).pop() || "";
      const relative = normalizedPath.slice(epPrefix.length);
      return `${folderName}/${relative}`;
    }
  }

  // 独立文件：返回 basename
  const parts = normalizedPath.split("/");
  return parts[parts.length - 1];
}

/**
 * 从 Session 的文件列表构建 headless-tree 所需的 dataLoader
 *
 * 与 buildTreeDataFromOffer 类似，但输入来自 TransferSession
 *
 * @param session TransferSession 对象
 * @returns dataLoader + rootChildren
 */
export function buildTreeDataFromSession(session: {
  files: { fileId: number; name: string; relativePath: string; size: number }[];
}): TreeData {
  return buildTreeDataFromOffer(session.files);
}
