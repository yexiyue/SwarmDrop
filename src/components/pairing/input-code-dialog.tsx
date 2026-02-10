/**
 * InputCodeDialog
 * 输入配对码弹窗：6 位 OTP 输入 → 查找设备 → 展示设备信息 → 发起配对
 */

import { useState } from "react";
import { Link, Loader2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
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
import { getDeviceIcon } from "@/components/pairing/device-icon";

export function InputCodeDialog() {
  const current = usePairingStore((s) => s.current);
  const searchDevice = usePairingStore((s) => s.searchDevice);
  const sendPairingRequest = usePairingStore((s) => s.sendPairingRequest);
  const reset = usePairingStore((s) => s.reset);

  const [code, setCode] = useState("");

  const isOpen =
    current.phase === "inputting" ||
    current.phase === "searching" ||
    current.phase === "found" ||
    current.phase === "requesting";

  const isSearching = current.phase === "searching";
  const isFound = current.phase === "found";
  const isRequesting = current.phase === "requesting";

  const deviceInfo = current.phase === "found" ? current.deviceInfo : null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setCode("");
      reset();
    }
  };

  const handleCodeComplete = (value: string) => {
    if (value.length === 6) {
      void searchDevice(value);
    }
  };

  const DeviceIcon = deviceInfo ? getDeviceIcon(deviceInfo.codeRecord.os) : Monitor;

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader className="flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Link className="size-6 text-primary" />
          </div>
          <ResponsiveDialogTitle className="text-center text-xl">
            <Trans>连接已有设备</Trans>
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-center">
            <Trans>输入另一台设备上显示的配对码</Trans>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* OTP 输入 */}
          {(current.phase === "inputting" || isSearching) && (
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              onComplete={handleCodeComplete}
              disabled={isSearching}
              autoFocus
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="size-14 text-2xl font-semibold" />
                <InputOTPSlot index={1} className="size-14 text-2xl font-semibold" />
                <InputOTPSlot index={2} className="size-14 text-2xl font-semibold" />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} className="size-14 text-2xl font-semibold" />
                <InputOTPSlot index={4} className="size-14 text-2xl font-semibold" />
                <InputOTPSlot index={5} className="size-14 text-2xl font-semibold" />
              </InputOTPGroup>
            </InputOTP>
          )}

          {/* 查找中 */}
          {isSearching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <Trans>正在查找设备...</Trans>
            </div>
          )}

          {/* 找到设备 */}
          {isFound && deviceInfo && (
            <div className="flex w-full flex-col items-center gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <DeviceIcon className="size-5 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {deviceInfo.codeRecord.hostname}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {deviceInfo.codeRecord.platform} · {deviceInfo.codeRecord.os}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 请求中 */}
          {isRequesting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <Trans>等待对方确认...</Trans>
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            <Trans>取消</Trans>
          </Button>
          {isFound && (
            <Button onClick={() => void sendPairingRequest()}>
              <Trans>发起配对</Trans>
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
