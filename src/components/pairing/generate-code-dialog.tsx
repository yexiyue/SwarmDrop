/**
 * GenerateCodeDialog
 * 桌面端生成配对码 Dialog：Link 图标 + 标题 + 6 位码展示 + 倒计时 + 取消/复制按钮
 */

import { useEffect, useState, useCallback } from "react";
import { Link, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const codeDigits = codeInfo?.code.split("") ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-100" showCloseButton={false}>
        <DialogHeader className="flex flex-col items-center gap-2">
          <div className="flex size-16 items-center justify-center rounded-full bg-blue-50">
            <Link className="size-7 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl font-semibold">
            <Trans>添加新设备</Trans>
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            <Trans>在另一台设备上输入以下配对码</Trans>
          </DialogDescription>
        </DialogHeader>

        {/* 配对码展示 */}
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex items-center gap-2">
            {codeDigits.slice(0, 3).map((digit, i) => (
              <div
                key={i}
                className="flex h-14 w-12 items-center justify-center rounded-lg bg-muted text-2xl font-semibold text-foreground"
              >
                {digit}
              </div>
            ))}
            <span className="text-xl font-semibold text-muted-foreground">-</span>
            {codeDigits.slice(3, 6).map((digit, i) => (
              <div
                key={i + 3}
                className="flex h-14 w-12 items-center justify-center rounded-lg bg-muted text-2xl font-semibold text-foreground"
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

        <DialogFooter className="flex-row justify-center gap-3 sm:justify-center">
          <Button variant="outline" onClick={() => reset()}>
            <Trans>取消</Trans>
          </Button>
          {isExpired ? (
            <Button
              onClick={() => void regenerateCode()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Trans>重新生成</Trans>
            </Button>
          ) : (
            <Button
              onClick={() => void handleCopy()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? <Trans>已复制</Trans> : <Trans>复制配对码</Trans>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
