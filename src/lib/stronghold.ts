/**
 * Stronghold Storage Adapter
 * 为 Zustand persist 提供加密存储后端
 */

import type { StateStorage } from "zustand/middleware";
import { Client, Stronghold } from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";
import { exists, remove } from "@tauri-apps/plugin-fs";

class StrongholdStorage implements StateStorage {
  private store: Awaited<ReturnType<Client["getStore"]>>;
  private stronghold: Stronghold;

  private constructor(
    store: Awaited<ReturnType<Client["getStore"]>>,
    stronghold: Stronghold
  ) {
    this.store = store;
    this.stronghold = stronghold;
  }

  static async create(
    password: string,
    clientName = "swarmdrop",
    options: { resetVault?: boolean } = {}
  ) {
    const vaultPath = `${await appDataDir()}/vault.hold`;

    // 如果需要重置 vault，先删除旧文件
    if (options.resetVault && (await exists(vaultPath))) {
      await remove(vaultPath);
    }

    const stronghold = await Stronghold.load(vaultPath, password);

    let client: Client;
    try {
      client = await stronghold.loadClient(clientName);
    } catch {
      client = await stronghold.createClient(clientName);
    }

    return new StrongholdStorage(client.getStore(), stronghold);
  }

  getItem = async (name: string): Promise<string | null> => {
    const data = await this.store.get(name);
    if (!data) return null;
    return new TextDecoder().decode(new Uint8Array(data));
  };

  setItem = async (name: string, value: string): Promise<void> => {
    const data = Array.from(new TextEncoder().encode(value));
    await this.store.insert(name, data);
    await this.stronghold.save();
  };

  removeItem = async (name: string): Promise<void> => {
    await this.store.remove(name);
    await this.stronghold.save();
  };
}

/** 全局 Stronghold 实例（解锁后设置） */
let strongholdStorage: StrongholdStorage | null = null;

/**
 * 初始化 Stronghold（使用用户密码）
 * @param password 用户设置的主密码
 * @param options.resetVault 是否重置 vault（首次设置时使用）
 */
export async function initStronghold(
  password: string,
  options: { resetVault?: boolean } = {}
): Promise<void> {
  strongholdStorage = await StrongholdStorage.create(password, "swarmdrop", options);
}

/**
 * 获取 Stronghold 存储实例
 * @throws 如果 Stronghold 未初始化
 */
export function getStrongholdStorage(): StateStorage {
  if (!strongholdStorage) {
    throw new Error("Stronghold not initialized. Call initStronghold first.");
  }
  return strongholdStorage;
}

/**
 * 检查 Stronghold 是否已初始化
 */
export function isStrongholdInitialized(): boolean {
  return strongholdStorage !== null;
}
