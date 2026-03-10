/**
 * Unlock Page (Lazy)
 * 解锁页面 - 懒加载组件
 */

import { useState } from "react";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore, BiometryType } from "@/stores/auth-store";
import { getAuthErrorMessage, isKnownErrorType } from "@/lib/auth-messages";
import { ScanFace, Fingerprint, Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createLazyFileRoute("/_auth/unlock")({
  component: UnlockPage,
});

function UnlockPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const {
    biometricEnabled,
    biometricType,
    unlock,
    unlockWithBiometric,
    isLoading,
    error,
    clearError,
  } = useAuthStore(
    useShallow((state) => ({
      biometricEnabled: state.biometricEnabled,
      biometricType: state.biometricType,
      unlock: state.unlock,
      unlockWithBiometric: state.unlockWithBiometric,
      isLoading: state.isLoading,
      error: state.error,
      clearError: state.clearError,
    }))
  );

  // 翻译错误消息
  const translatedError = error
    ? isKnownErrorType(error)
      ? t(getAuthErrorMessage(error) as import("@lingui/core").MessageDescriptor)
      : error
    : null;

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // 默认显示生物识别模式（如果启用了的话）
  const [showPasswordMode, setShowPasswordMode] = useState(false);

  const handlePasswordUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    clearError();
    const success = await unlock(password);
    if (success) {
      navigate({ to: "/devices" });
    }
  };

  const handleBiometricUnlock = async () => {
    clearError();
    const success = await unlockWithBiometric();
    if (success) {
      navigate({ to: "/devices" });
    }
  };

  // 根据生物识别类型选择图标
  const BiometricIcon =
    biometricType === BiometryType.FaceID ? ScanFace : Fingerprint;

  // 生物识别模式
  if (biometricEnabled && !showPasswordMode) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-xl bg-card p-10 shadow-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img src="/app-icon.svg" alt="SwarmDrop" className="h-14 w-14" />
          <h1 className="text-lg font-semibold">SwarmDrop</h1>
        </div>

        {/* Biometric Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
          <BiometricIcon className="h-10 w-10 text-foreground" />
        </div>

        {/* Unlock Button */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleBiometricUnlock}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t(msg`解锁中...`)}
            </>
          ) : (
            t(msg`解锁`)
          )}
        </Button>

        {/* Error */}
        {error && <p className="text-sm text-destructive text-center">{translatedError}</p>}

        {/* Switch to Password */}
        <button
          type="button"
          onClick={() => setShowPasswordMode(true)}
          className="text-sm text-primary hover:underline"
        >
          <Trans>使用密码解锁</Trans>
        </button>
      </div>
    );
  }

  // 密码模式
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-xl bg-card p-10 shadow-sm">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <img src="/app-icon.svg" alt="SwarmDrop" className="h-14 w-14" />
        <h1 className="text-lg font-semibold">SwarmDrop</h1>
      </div>

      {/* Password Form */}
      <form onSubmit={handlePasswordUnlock} className="w-full space-y-4">
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder={t(msg`输入密码`)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Error */}
        {error && <p className="text-sm text-destructive text-center">{translatedError}</p>}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!password || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t(msg`解锁中...`)}
            </>
          ) : (
            t(msg`解锁`)
          )}
        </Button>
      </form>

      {/* Switch to Biometric */}
      {biometricEnabled && (
        <button
          type="button"
          onClick={() => setShowPasswordMode(false)}
          className="text-sm text-primary hover:underline"
        >
          {biometricType === BiometryType.FaceID ? (
            <Trans>使用面容解锁</Trans>
          ) : (
            <Trans>使用指纹解锁</Trans>
          )}
        </button>
      )}
    </div>
  );
}
