/**
 * Identity commands
 * 身份/密钥对相关命令
 */

import { invoke } from "@tauri-apps/api/core";

/**
 * 生成新的 Ed25519 密钥对
 * @returns protobuf 编码的密钥对字节数组
 */
export async function generateKeypair(): Promise<number[]> {
  return await invoke("generate_keypair");
}

/**
 * 注册密钥对到后端状态管理
 * @param keypair - protobuf 编码的密钥对字节数组
 * @returns PeerId 字符串
 */
export async function registerKeypair(keypair: number[]): Promise<string> {
  return await invoke("register_keypair", { keypair });
}
