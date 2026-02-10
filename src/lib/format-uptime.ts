/**
 * 格式化运行时长
 * @param startedAt 启动时间戳 (ms)
 * @returns 格式化字符串，如 "2 小时 15 分钟"
 */
export function formatUptime(startedAt: number): string {
  const elapsed = Date.now() - startedAt;
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours} 小时 ${remainingMinutes} 分钟`;
  }
  if (minutes > 0) {
    return `${minutes} 分钟`;
  }
  return "刚刚启动";
}
