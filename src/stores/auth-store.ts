/**
 * Auth Store
 * 管理应用认证状态
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { rehydrateSecretStore } from "@/stores/secret-store";
import {
  checkStatus,
  setData,
  getData,
  removeData,
  BiometryType,
  type Status,
} from "@choochmeque/tauri-plugin-biometry-api";

/** Biometry 数据存储配置 */
const BIOMETRY_DOMAIN = "com.yexiyue.swarmdrop";
const STRONGHOLD_PASSWORD_KEY = "stronghold_password";

// 重新导出 BiometryType 供外部使用
export { BiometryType };

/** 加载消息类型 */
export type LoadingMessageType =
  | "initializing_storage"
  | "generating_keypair"
  | "decrypting_data"
  | "loading_keypair";

/** 错误消息类型 */
export type ErrorMessageType =
  | "password_not_found"
  | "wrong_password"
  | "biometric_not_enabled"
  | "biometric_not_available"
  | "stored_password_not_found";

interface AuthState {
  /** 是否已完成初始设置 */
  isSetupComplete: boolean;
  /** 是否启用生物识别 */
  biometricEnabled: boolean;
  /** 生物识别是否可用 */
  biometricAvailable: boolean;
  /** 生物识别类型 */
  biometricType: BiometryType;
  /** 是否已解锁（运行时状态，不持久化） */
  isUnlocked: boolean;
  /** 加载状态 */
  isLoading: boolean;
  /** 加载状态消息类型（在 UI 层翻译） */
  loadingMessage: LoadingMessageType | null;
  /** 错误消息类型（在 UI 层翻译），或原始错误字符串 */
  error: ErrorMessageType | string | null;
  /** 临时密码（仅在设置流程中使用，用于启用生物识别） */
  _tempPassword: string | null;

  // === Actions ===

  /** 检查生物识别可用性 */
  checkBiometricAvailability: () => Promise<void>;

  /** 检查设置状态 */
  checkSetupStatus: () => void;

  /** 设置密码并完成初始设置 */
  setupPassword: (password: string) => Promise<void>;

  /** 启用生物识别（如果未提供密码，使用临时密码） */
  enableBiometric: (password?: string) => Promise<void>;

  /** 禁用生物识别 */
  disableBiometric: () => Promise<void>;

  /** 清除临时密码 */
  clearTempPassword: () => void;

  /** 使用密码解锁 */
  unlock: (password: string) => Promise<boolean>;

  /** 使用生物识别解锁 */
  unlockWithBiometric: () => Promise<boolean>;

  /** 锁定应用 */
  lock: () => void;

  /** 清除错误 */
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isSetupComplete: false,
      biometricEnabled: false,
      biometricAvailable: false,
      biometricType: BiometryType.None,
      isUnlocked: false,
      isLoading: false,
      loadingMessage: null,
      error: null,
      _tempPassword: null,

      checkSetupStatus: () => {
        // persist middleware 会自动从 localStorage 恢复 isSetupComplete
        // 这里只是提供一个显式的检查入口
      },

      async checkBiometricAvailability() {
        try {
          const status: Status = await checkStatus();
          console.log("Biometric status:", status);
          const available = status.isAvailable;
          const biometryType = status.biometryType ?? BiometryType.None;

          set({
            biometricAvailable: available,
            biometricType: biometryType,
          });
        } catch (err) {
          // 如果检查失败，标记为不可用
          console.error("Failed to check biometric status:", err);
          set({
            biometricAvailable: false,
            biometricType: BiometryType.None,
          });
        }
      },

      async setupPassword(password: string) {
        set({ isLoading: true, loadingMessage: "initializing_storage", error: null });

        try {
          // 导入并初始化 Stronghold
          // 首次设置时重置 vault，避免密码冲突
          const { initStronghold } = await import("@/lib/stronghold");
          await initStronghold(password, { resetVault: true });

          set({ loadingMessage: "generating_keypair" });
          // 初始化 secret store（生成密钥对）
          await rehydrateSecretStore();

          // 标记设置完成，并临时保存密码供启用生物识别使用
          set({
            isSetupComplete: true,
            isUnlocked: true,
            isLoading: false,
            loadingMessage: null,
            _tempPassword: password, // 临时保存密码
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : String(err),
            isLoading: false,
            loadingMessage: null,
          });
          throw err;
        }
      },

      async enableBiometric(password?: string) {
        set({ isLoading: true, error: null });

        try {
          // 使用提供的密码或临时密码
          const pwd = password || get()._tempPassword;
          if (!pwd) {
            throw new Error("password_not_found");
          }

          // 使用 biometry 插件将密码存储到系统安全存储
          await setData({
            domain: BIOMETRY_DOMAIN,
            name: STRONGHOLD_PASSWORD_KEY,
            data: pwd,
          });
          set({
            biometricEnabled: true,
            isLoading: false,
            _tempPassword: null, // 清除临时密码
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : String(err),
            isLoading: false,
          });
          throw err;
        }
      },

      async disableBiometric() {
        set({ isLoading: true, error: null });

        try {
          // 使用 biometry 插件从系统安全存储删除密码
          await removeData({
            domain: BIOMETRY_DOMAIN,
            name: STRONGHOLD_PASSWORD_KEY,
          });
          set({ biometricEnabled: false, isLoading: false });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : String(err),
            isLoading: false,
          });
          throw err;
        }
      },

      async unlock(password: string) {
        set({ isLoading: true, loadingMessage: "decrypting_data", error: null });

        try {
          const { initStronghold } = await import("@/lib/stronghold");
          await initStronghold(password);

          set({ loadingMessage: "loading_keypair" });
          // 加载 secret store
          await rehydrateSecretStore();

          set({ isUnlocked: true, isLoading: false, loadingMessage: null });
          return true;
        } catch (err) {
          set({
            error: "wrong_password",
            isLoading: false,
            loadingMessage: null,
          });
          return false;
        }
      },

      async unlockWithBiometric() {
        const { biometricEnabled, biometricAvailable } = get();
        if (!biometricEnabled) {
          set({ error: "biometric_not_enabled" });
          return false;
        }

        if (!biometricAvailable) {
          set({ error: "biometric_not_available" });
          return false;
        }

        set({ isLoading: true, error: null });

        try {
          // 使用 biometry 插件获取密码（会自动触发生物识别验证）
          // 注意：reason 字符串由系统 API 显示，不经过我们的 i18n 系统
          const response = await getData({
            domain: BIOMETRY_DOMAIN,
            name: STRONGHOLD_PASSWORD_KEY,
            reason: "Unlock SwarmDrop",
            cancelTitle: "Cancel",
          });

          const password = response.data;
          if (!password) {
            throw new Error("stored_password_not_found");
          }

          // 使用密码解锁
          const { initStronghold } = await import("@/lib/stronghold");
          await initStronghold(password);

          // 加载 secret store
          await rehydrateSecretStore();

          set({ isUnlocked: true, isLoading: false });
          return true;
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : String(err),
            isLoading: false,
          });
          return false;
        }
      },

      lock() {
        set({ isUnlocked: false });
      },

      clearError() {
        set({ error: null, loadingMessage: null });
      },

      clearTempPassword() {
        set({ _tempPassword: null });
      },
    }),
    {
      name: "auth-store",
      // 只持久化配置状态，不持久化运行时状态
      partialize: (state) => ({
        isSetupComplete: state.isSetupComplete,
        biometricEnabled: state.biometricEnabled,
      }),
    }
  )
);
