/**
 * Desktop Generate Code Page (Route)
 * 桌面端生成配对码页面
 * Toolbar（← 添加新设备）+ 居中 6 位码展示 + 倒计时 + 取消/复制按钮
 */

import { useEffect, useState, useCallback } from "react";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Link, Copy, Check, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trans } from "@lingui/react/macro";
import { usePairingStore } from "@/stores/pairing-store";

export const Route = createLazyFileRoute("/_app/pairing/generate")({
  component: PairingGeneratePage,
});

function PairingGeneratePage() {
  const navigate = useNavigate();

  const current = usePairingStore((s) => s.current);
  const generateCode = usePairingStore((s) => s.generateCode);
  const regenerateCode = usePairingStore((s) => s.regenerateCode);

  const codeInfo = current.phase === "generating" ? current.codeInfo : null;

  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  // 进入页面时生成配对码
  useEffect(() => {
    void generateCode();
    return () => {
      usePairingStore.getState().reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 配对成功后自动返回
  useEffect(() => {
    if (current.phase === "success") {
      void navigate({ to: "/devices" });
    }
  }, [current.phase, navigate]);

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

  const handleBack = () => {
    void navigate({ to: "/devices" });
  };

  const codeDigits = codeInfo?.code.split("") ?? [];

  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      {/* Toolbar */}
      <header className="flex h-13 items-center border-b border-border px-4 lg:px-5">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-[15px] font-medium text-foreground"
        >
          <ArrowLeft className="size-4" />
          <Trans>添加新设备</Trans>
        </button>
      </header>

      {/* 居中内容 */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          {/* Link 图标 */}
          <div className="flex size-16 items-center justify-center rounded-full bg-blue-50">
            <Link className="size-7 text-blue-600" />
          </div>

          {/* 标题 */}
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              <Trans>添加新设备</Trans>
            </h2>
            <p className="text-sm text-muted-foreground">
              <Trans>在另一台设备上输入以下配对码</Trans>
            </p>
          </div>

          {/* 6 位配对码展示 */}
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

          {/* 倒计时 */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {isExpired ? (
              <Trans>配对码已过期</Trans>
            ) : (
              <Trans>配对码将在 {formatTime(remainingSeconds)} 后过期</Trans>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleBack}>
              <Trans>取消</Trans>
            </Button>
            {isExpired ? (
              <Button
                onClick={() => void regenerateCode()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className="size-4" />
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
          </div>
        </div>
      </div>
    </main>
  );
}
