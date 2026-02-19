/**
 * Desktop Input Code Page (Route)
 * 桌面端输入配对码页面
 * - 输入阶段：Toolbar（← 连接已有设备）+ 居中 OTP 输入 + 取消/确认
 * - 设备详情：Toolbar（← 设备详情）+ 居中设备信息卡片 + 取消/发送配对请求
 */

import { useState, useEffect } from "react";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Link, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { Trans } from "@lingui/react/macro";
import { useShallow } from "zustand/react/shallow";
import { usePairingStore } from "@/stores/pairing-store";
import {
  DesktopDeviceFoundContent,
  useDeviceFoundState,
} from "@/routes/_app/pairing/-device-found-view";

export const Route = createLazyFileRoute("/_app/pairing/input")({
  component: PairingInputPage,
});

function PairingInputPage() {
  const navigate = useNavigate();

  const { current, searchDevice, sendPairingRequest, openInput, reset } =
    usePairingStore(
      useShallow((state) => ({
        current: state.current,
        searchDevice: state.searchDevice,
        sendPairingRequest: state.sendPairingRequest,
        openInput: state.openInput,
        reset: state.reset,
      }))
    );

  const [code, setCode] = useState("");

  const { showDeviceFound, deviceInfo, isRequesting } = useDeviceFoundState();

  // 进入页面时初始化输入状态
  useEffect(() => {
    openInput();
    return () => {
      usePairingStore.getState().reset();
    };
  }, [openInput]);

  // 配对成功后自动返回
  useEffect(() => {
    if (current.phase === "success") {
      void navigate({ to: "/devices" });
    }
  }, [current.phase, navigate]);

  const isSearching = current.phase === "searching";

  const handleCodeComplete = (value: string) => {
    if (value.length === 6) {
      void searchDevice(value);
    }
  };

  const handleConfirm = () => {
    if (code.length === 6) {
      void searchDevice(code);
    }
  };

  const handleBack = () => {
    void navigate({ to: "/devices" });
  };

  // ─── 设备详情视图 ───
  if (showDeviceFound && deviceInfo) {
    return (
      <main className="flex h-full flex-1 flex-col bg-background">
        <header className="flex h-13 items-center border-b border-border px-4 lg:px-5">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 text-[15px] font-medium text-foreground"
          >
            <ArrowLeft className="size-4" />
            <Trans>设备详情</Trans>
          </button>
        </header>

        <div className="flex flex-1 items-center justify-center">
          <DesktopDeviceFoundContent
            deviceInfo={deviceInfo}
            isRequesting={isRequesting}
            onSendRequest={() => void sendPairingRequest()}
            onCancel={reset}
          />
        </div>
      </main>
    );
  }

  // ─── 输入配对码视图 ───
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
            disabled={isSearching}
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
          {isSearching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <Trans>正在查找设备...</Trans>
            </div>
          )}

          {/* 底部按钮 */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleBack}>
              <Trans>取消</Trans>
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={code.length < 6 || isSearching}
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
