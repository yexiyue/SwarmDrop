/**
 * 版本比较工具 + latest.json 移动端解析
 */

/** 移动端 latest.json 中的 Android 信息 */
export interface MobileAndroidInfo {
  version: string;
  download_url: string;
  min_version?: string;
}

/** latest.json 扩展结构（包含移动端字段） */
export interface LatestJson {
  version: string;
  notes?: string;
  pub_date?: string;
  platforms?: Record<string, { signature: string; url: string }>;
  mobile?: {
    android?: MobileAndroidInfo;
  };
}

/**
 * 将版本号字符串解析为数字三元组
 * "1.2.3" → [1, 2, 3]
 * "1.2.3-beta.1" → [1, 2, 3]（忽略预发布标签，预发布 < 正式版）
 */
function parseVersion(version: string): [number, number, number] {
  const clean = version.replace(/^v/, "").split("-")[0];
  const parts = clean.split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * 比较两个语义化版本号
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parseVersion(a);
  const pb = parseVersion(b);

  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }

  // 如果数字部分相同，有预发布标签的视为更低版本
  const aHasPrerelease = a.replace(/^v/, "").includes("-");
  const bHasPrerelease = b.replace(/^v/, "").includes("-");
  if (aHasPrerelease && !bHasPrerelease) return -1;
  if (!aHasPrerelease && bHasPrerelease) return 1;

  return 0;
}

/** 检查版本 a 是否低于版本 b */
export function isVersionLessThan(a: string, b: string): boolean {
  return compareVersions(a, b) === -1;
}
