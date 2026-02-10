/**
 * DesktopInputCodePage
 * 桌面端输入配对码全屏页面：Toolbar（← 连接已有设备）+ 居中内容 + OTP 输入 + 取消/确认
 */

import { useState } from "react";
import { ArrowLeft, Link, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { Trans } from "@lingui/react/macro";
import { usePairingStore } from "@/stores/pairing-store";

export function DesktopInputCodePage() {
  const current = usePairingStore((s) => s.current);
  const searchDevice = usePairingStore((s) => s.searchDevice);
  const sendPairingRequest = usePairingStore((s) => s.sendPairingRequest);
  const closePairingView = usePairingStore((s) => s.closePairingView);

  const [code, setCode] = useState("");

  const isSearching = current.phase === "searching";
  const isFound = current.phase === "found";
  const isRequesting = current.phase === "requesting";

  const handleCodeComplete = (value: string) => {
    if (value.length === 6) {
      void searchDevice(value);
    }
  };

  const handleConfirm = () => {
    if (isFound) {
      void sendPairingRequest();
    } else if (code.length === 6) {
      void searchDevice(code);
    }
  };

  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      {/* Toolbar */}
      <header className="flex h-13 items-center border-b border-border px-4 lg:px-5">
        <button
          type="button"
          onClick={closePairingView}
          className="flex items-center gap-1.5 text-[15px] font-medium text-foreground"
        >
          <ArrowLeft className="size-4" />
          <Trans>连接已有设备</Trans>
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
              <Trans>连接已有设备</Trans>
            </h2>
            <p className="text-sm text-muted-foreground">
              <Trans>输入另一台设备上显示的配对码</Trans>
            </p>
          </div>

          {/* OTP 输入框 */}
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            onComplete={handleCodeComplete}
            disabled={isSearching || isRequesting}
            autoFocus
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="h-14 w-12 text-2xl font-semibold" />
              <InputOTPSlot index={1} className="h-14 w-12 text-2xl font-semibold" />
              <InputOTPSlot index={2} className="h-14 w-12 text-2xl font-semibold" />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} className="h-14 w-12 text-2xl font-semibold" />
              <InputOTPSlot index={4} className="h-14 w-12 text-2xl font-semibold" />
              <InputOTPSlot index={5} className="h-14 w-12 text-2xl font-semibold" />
            </InputOTPGroup>
          </InputOTP>

          {/* 状态提示 */}
          {(isSearching || isRequesting) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {isSearching ? (
                <Trans>正在查找设备...</Trans>
              ) : (
                <Trans>等待对方确认...</Trans>
              )}
            </div>
          )}

          {/* 底部按钮 */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={closePairingView}>
              <Trans>取消</Trans>
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={code.length < 6 || isSearching || isRequesting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Trans>确认</Trans>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
