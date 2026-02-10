/**
 * GenerateCodeDialog
 * 生成配对码弹窗：展示 6 位配对码 + 倒计时 + 复制/重新生成
 */

import { useEffect, useState, useCallback } from "react";
import { Link, Copy, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive-dialog";
import { Trans } from "@lingui/react/macro";
import { usePairingStore } from "@/stores/pairing-store";

export function GenerateCodeDialog() {
  const current = usePairingStore((s) => s.current);
  const regenerateCode = usePairingStore((s) => s.regenerateCode);
  const reset = usePairingStore((s) => s.reset);

  const isOpen = current.phase === "generating";
  const codeInfo = current.phase === "generating" ? current.codeInfo : null;

  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  // 倒计时
  useEffect(() => {
    if (!codeInfo) return;

    const updateRemaining = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, codeInfo.expiresAt - now);
      setRemainingSeconds(remaining);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [codeInfo]);

  // 复制状态自动重置
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const isExpired = remainingSeconds <= 0 && codeInfo !== null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleCopy = useCallback(async () => {
    if (!codeInfo) return;
    try {
      await navigator.clipboard.writeText(codeInfo.code);
      setCopied(true);
    } catch {
      toast.error("复制失败，请手动复制配对码");
    }
  }, [codeInfo]);

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
  };

  // 将 code 分为两组 3 位
  const codeDigits = codeInfo?.code.split("") ?? [];

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader className="flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Link className="size-6 text-primary" />
          </div>
          <ResponsiveDialogTitle className="text-center text-xl">
            <Trans>添加新设备</Trans>
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-center">
            <Trans>在另一台设备上输入以下配对码</Trans>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* 配对码展示 */}
        <div className="flex flex-col items-center gap-4 py-4" aria-label="配对码">
          <div className="flex items-center gap-2">
            {codeDigits.slice(0, 3).map((digit, i) => (
              <div
                key={i}
                className="flex size-14 items-center justify-center rounded-lg bg-muted text-2xl font-semibold text-foreground"
              >
                {digit}
              </div>
            ))}
            <span className="text-2xl font-semibold text-muted-foreground">-</span>
            {codeDigits.slice(3, 6).map((digit, i) => (
              <div
                key={i + 3}
                className="flex size-14 items-center justify-center rounded-lg bg-muted text-2xl font-semibold text-foreground"
              >
                {digit}
              </div>
            ))}
          </div>

          {/* 过期提示 */}
          <p className="text-xs text-muted-foreground">
            {isExpired ? (
              <Trans>配对码已过期</Trans>
            ) : (
              <Trans>配对码将在 {formatTime(remainingSeconds)} 后过期</Trans>
            )}
          </p>
        </div>

        <ResponsiveDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
          <Button variant="outline" onClick={() => reset()}>
            <Trans>取消</Trans>
          </Button>
          {isExpired ? (
            <Button onClick={() => void regenerateCode()}>
              <RefreshCw className="size-4" />
              <Trans>重新生成</Trans>
            </Button>
          ) : (
            <Button onClick={() => void handleCopy()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? <Trans>已复制</Trans> : <Trans>复制配对码</Trans>}
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
