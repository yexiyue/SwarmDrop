/**
 * Enable Biometric Page (Lazy)
 * 启用生物识别页面 - 懒加载组件
 */

import { useEffect } from "react";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { ScanFace, Loader2 } from "lucide-react";

export const Route = createLazyFileRoute("/_auth/enable-biometric")({
  component: EnableBiometricPage,
});

function EnableBiometricPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const {
    biometricAvailable,
    enableBiometric,
    clearTempPassword,
    isLoading,
    error,
    clearError,
  } = useAuthStore(
    useShallow((state) => ({
      biometricAvailable: state.biometricAvailable,
      enableBiometric: state.enableBiometric,
      clearTempPassword: state.clearTempPassword,
      isLoading: state.isLoading,
      error: state.error,
      clearError: state.clearError,
    })),
  );

  console.log("Biometric availability:", biometricAvailable);
  const handleSkip = () => {
    clearTempPassword(); // 清除临时密码
    navigate({ to: "/devices" });
  };

  const handleEnable = async () => {
    clearError();
    try {
      // 使用 store 中的临时密码
      await enableBiometric();
      navigate({ to: "/devices" });
    } catch (err) {
      console.error("Failed to enable biometric:", err);
      // 即使失败也允许继续
      handleSkip();
    }
  };

  // 如果生物识别不可用，自动跳过
  useEffect(() => {
    if (!biometricAvailable) {
      navigate({ to: "/devices" });
    }
  }, [biometricAvailable, navigate]);

  // 在检查期间显示 loading
  if (!biometricAvailable) {
    return null;
  }

  return (
    <div className="w-full max-w-sm rounded-xl bg-card p-8 shadow-sm">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
          <ScanFace className="h-10 w-10 text-foreground" />
        </div>
      </div>

      {/* Text */}
      <div className="mt-6 space-y-2 text-center">
        <h1 className="text-xl font-bold">
          <Trans>启用快捷解锁？</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>使用指纹或面容快速解锁应用，无需每次输入密码</Trans>
        </p>
      </div>

      {/* Buttons */}
      <div className="mt-8 space-y-3">
        <Button
          size="lg"
          className="w-full"
          onClick={handleEnable}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t(msg`启用中...`)}
            </>
          ) : (
            t(msg`启用生物识别`)
          )}
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={handleSkip}
          disabled={isLoading}
        >
          <Trans>稍后设置</Trans>
        </Button>
      </div>

      {/* Error */}
      {error && (
        <p className="mt-4 text-center text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
