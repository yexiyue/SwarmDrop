/**
 * Tauri Plugin Store 的 Zustand StateStorage 适配器
 * 将 tauri-plugin-store 封装为 Zustand persist 中间件可用的 StateStorage
 */

import { load, type Store } from "@tauri-apps/plugin-store";
import type { StateStorage } from "zustand/middleware";

/** 已加载的 Store 实例缓存 */
const stores = new Map<string, Store>();

/**
 * 延迟加载指定的 Tauri Store
 * 在首次访问时才初始化，避免模块顶层副作用
 */
async function getStore(path: string): Promise<Store> {
  let store = stores.get(path);
  if (!store) {
    store = await load(path, { defaults: {}, autoSave: true });
    stores.set(path, store);
  }
  return store;
}

/**
 * 创建基于 tauri-plugin-store 的 Zustand StateStorage
 *
 * @param path 存储文件名，保存在应用配置目录下（如 "preferences.json"）
 *
 * @example
 * ```ts
 * import { createJSONStorage, persist } from "zustand/middleware";
 * import { createTauriStorage } from "@/lib/tauri-store";
 *
 * persist(storeCreator, {
 *   name: "my-store",
 *   storage: createJSONStorage(() => createTauriStorage("my-store.json")),
 * })
 * ```
 */
export function createTauriStorage(path: string): StateStorage {
  return {
    getItem: async (name: string) => {
      const store = await getStore(path);
      return (await store.get<string>(name)) ?? null;
    },
    setItem: async (name: string, value: string) => {
      const store = await getStore(path);
      await store.set(name, value);
    },
    removeItem: async (name: string) => {
      const store = await getStore(path);
      await store.delete(name);
    },
  };
}
