/**
 * 后端错误处理工具
 *
 * Tauri invoke 失败时抛出的是后端 AppError 序列化后的对象：
 * `{ kind: "NodeNotStarted", message: "Node not started" }`
 */

/** 后端 AppError 序列化格式 */
export interface AppError {
  kind: string;
  message: string;
}

/** 判断错误是否为后端 AppError */
export function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "kind" in err &&
    "message" in err
  );
}

/** 判断错误是否为特定 kind */
export function isErrorKind(err: unknown, kind: string): boolean {
  return isAppError(err) && err.kind === kind;
}

/** 从错误中提取人类可读的消息 */
export function getErrorMessage(err: unknown): string {
  if (isAppError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
