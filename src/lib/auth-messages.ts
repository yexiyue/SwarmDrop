/**
 * Auth Store 消息翻译辅助
 * 在 UI 层翻译 store 中的消息类型
 */

import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import type { LoadingMessageType, ErrorMessageType } from "@/stores/auth-store";

/** 加载消息映射 */
const loadingMessages: Record<LoadingMessageType, MessageDescriptor> = {
  initializing_storage: msg`正在初始化加密存储...`,
  generating_keypair: msg`正在生成设备密钥...`,
  decrypting_data: msg`正在解密数据...`,
  loading_keypair: msg`正在加载设备密钥...`,
};

/** 错误消息映射 */
const errorMessages: Record<ErrorMessageType, MessageDescriptor> = {
  password_not_found: msg`无法获取密码`,
  wrong_password: msg`密码错误`,
  biometric_not_enabled: msg`生物识别未启用`,
  biometric_not_available: msg`生物识别不可用`,
  stored_password_not_found: msg`未找到存储的密码`,
};

/** 已知的错误消息类型 */
const knownErrorTypes = new Set<string>(Object.keys(errorMessages));

/**
 * 获取加载消息的翻译描述符
 */
export function getLoadingMessage(type: LoadingMessageType): MessageDescriptor {
  return loadingMessages[type];
}

/**
 * 获取错误消息的翻译描述符
 * 如果是已知类型返回翻译，否则返回原始字符串
 */
export function getErrorMessage(error: ErrorMessageType | string): MessageDescriptor | string {
  if (knownErrorTypes.has(error)) {
    return errorMessages[error as ErrorMessageType];
  }
  return error;
}

/**
 * 检查是否为已知错误类型
 */
export function isKnownErrorType(error: string): error is ErrorMessageType {
  return knownErrorTypes.has(error);
}
