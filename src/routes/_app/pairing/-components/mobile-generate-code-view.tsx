/**
 * MobileGenerateCodeView
 * 移动端"生成配对码" Tab 内容：Link 图标 + 说明 + 6 位码展示 + 倒计时 + 重新生成按钮
 */

import { useEffect, useState } from "react";
import { Link, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Trans } from "@lingui/react/macro";
import { usePairingStore } from "@/stores/pairing-store";

export function MobileGenerateCodeView() {
  const current = usePairingStore((s) => s.current);
  const regenerateCode = usePairingStore((s) => s.regenerateCode);

  const codeInfo = current.phase === "generating" ? current.codeInfo : null;

  const [remainingSeconds, setRemainingSeconds] = useState(0);

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

  const isExpired = remainingSeconds <= 0 && codeInfo !== null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const codeDigits = codeInfo?.code.split("") ?? [];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-8">
      {/* Link 图标 */}
      <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-600/8">
        <Link className="size-7 text-blue-600" />
      </div>

      {/* 说明文字 */}
      <p className="text-sm text-muted-foreground">
        <Trans>在另一台设备上输入此配对码</Trans>
      </p>

      {/* 6 位配对码展示 */}
      <div className="flex items-center gap-2">
        {codeDigits.slice(0, 3).map((digit, i) => (
          <div
            key={i}
            className="flex h-[60px] w-12 items-center justify-center rounded-xl bg-muted text-[28px] font-bold text-foreground"
          >
            {digit}
          </div>
        ))}
        <span className="text-xl font-semibold text-muted-foreground">-</span>
        {codeDigits.slice(3, 6).map((digit, i) => (
          <div
            key={i + 3}
            className="flex h-[60px] w-12 items-center justify-center rounded-xl bg-muted text-[28px] font-bold text-foreground"
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

      {/* 重新生成按钮 */}
      <Button
        onClick={() => void regenerateCode()}
        className="w-full bg-blue-600 hover:bg-blue-700"
        size="lg"
      >
        <RefreshCw className="size-4" />
        <Trans>重新生成</Trans>
      </Button>
    </div>
  );
}
