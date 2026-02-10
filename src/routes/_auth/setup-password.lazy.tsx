/**
 * Setup Password Page (Lazy)
 * 设置主密码页面 - 懒加载组件
 */

import { useState } from "react";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { getErrorMessage, getLoadingMessage, isKnownErrorType } from "@/lib/auth-messages";
import { ArrowLeft, Eye, EyeOff, Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/_auth/setup-password")({
  component: SetupPasswordPage,
});

interface PasswordStrength {
  score: number; // 0-3
  label: MessageDescriptor;
  color: string;
}

// Hoist pure function outside component to avoid recreation on every render
function calculatePasswordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-zA-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

// Define strength labels outside component using msg macro
const STRENGTH_LEVELS: PasswordStrength[] = [
  { score: 0, label: msg`弱`, color: "bg-destructive" },
  { score: 1, label: msg`一般`, color: "bg-orange-500" },
  { score: 2, label: msg`中等`, color: "bg-primary" },
  { score: 3, label: msg`强`, color: "bg-green-500" },
];

// Define requirements messages outside component
const REQUIREMENTS = {
  length: msg`至少 8 个字符`,
  alphanumeric: msg`包含字母和数字`,
  special: msg`推荐包含特殊字符`,
};

function SetupPasswordPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { setupPassword, isLoading, loadingMessage, error, clearError } = useAuthStore(
    useShallow((state) => ({
      setupPassword: state.setupPassword,
      isLoading: state.isLoading,
      loadingMessage: state.loadingMessage,
      error: state.error,
      clearError: state.clearError,
    })),
  );

  // 翻译加载消息和错误消息
  const translatedLoadingMessage = loadingMessage
    ? t(getLoadingMessage(loadingMessage))
    : null;
  const translatedError = error
    ? isKnownErrorType(error)
      ? t(getErrorMessage(error) as MessageDescriptor)
      : error
    : null;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Calculate strength score, no need for useMemo (simple calculation)
  const strengthScore = calculatePasswordScore(password);
  const strength = STRENGTH_LEVELS[strengthScore];

  // Calculate requirements, no need for useMemo (simple boolean checks)
  const requirements = [
    { met: password.length >= 8, label: t(REQUIREMENTS.length) },
    {
      met: /[a-zA-Z]/.test(password) && /[0-9]/.test(password),
      label: t(REQUIREMENTS.alphanumeric),
    },
    { met: /[^a-zA-Z0-9]/.test(password), label: t(REQUIREMENTS.special) },
  ];

  const isValid =
    password.length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    clearError();
    try {
      await setupPassword(password);
      console.log("Password setup successful");
      // 跳转到启用生物识别页面（密码已保存在 store 中）
      navigate({ to: "/enable-biometric" });
    } catch (e) {
      console.error(e);
      // 错误已在 store 中处理
    }
  };

  return (
    <div className="w-full max-w-sm rounded-xl bg-card p-8 shadow-sm">
      {/* Header */}
      <div className="space-y-2">
        <Link
          to="/welcome"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <Trans>返回</Trans>
        </Link>
        <h1 className="text-xl font-bold">
          <Trans>创建主密码</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>此密码用于保护您的设备身份，请妥善保管</Trans>
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* Password Input */}
        <div className="space-y-2">
          <Label htmlFor="password">
            <Trans>密码</Trans>
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t(msg`输入至少 8 位密码`)}
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
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirm">
            <Trans>确认密码</Trans>
          </Label>
          <div className="relative">
            <Input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              placeholder={t(msg`再次输入密码`)}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="text-sm text-destructive">
              <Trans>密码不匹配</Trans>
            </p>
          )}
        </div>

        {/* Password Strength */}
        {password && (
          <div className="space-y-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < strength.score ? strength.color : "bg-muted",
                  )}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              <Trans>密码强度：{t(strength.label)}</Trans>
            </p>
          </div>
        )}

        {/* Requirements */}
        <div className="rounded-lg bg-muted p-4 space-y-2">
          <p className="text-sm font-medium">
            <Trans>密码要求</Trans>
          </p>
          {requirements.map((req) => (
            <div key={req.label} className="flex items-center gap-2 text-sm">
              {req.met ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span
                className={
                  req.met ? "text-foreground" : "text-muted-foreground"
                }
              >
                {req.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error */}
        {translatedError && <p className="text-sm text-destructive">{translatedError}</p>}

        {/* Submit */}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!isValid || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {translatedLoadingMessage ?? t(msg`创建中...`)}
            </>
          ) : (
            t(msg`下一步`)
          )}
        </Button>
      </form>
    </div>
  );
}
