/**
 * MobileInputCodeView
 * 移动端"输入配对码" Tab 内容：Keyboard 图标 + 说明 + OTP 输入框 + 查找设备按钮
 */

import { useState } from "react";
import { Keyboard, Search } from "lucide-react";
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

export function MobileInputCodeView() {
  const { current, searchDevice } = usePairingStore(
    useShallow((state) => ({
      current: state.current,
      searchDevice: state.searchDevice,
    }))
  );

  const [code, setCode] = useState("");

  const isSearching = current.phase === "searching";

  const handleCodeComplete = (value: string) => {
    if (value.length === 6) {
      void searchDevice(value);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-8">
      {/* Keyboard 图标 */}
      <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-600/8">
        <Keyboard className="size-7 text-blue-600" />
      </div>

      {/* 说明文字 */}
      <p className="text-sm text-muted-foreground">
        <Trans>输入另一台设备上的配对码</Trans>
      </p>

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
          <InputOTPSlot index={0} className="h-14 w-11 text-lg font-semibold" />
          <InputOTPSlot index={1} className="h-14 w-11 text-lg font-semibold" />
          <InputOTPSlot index={2} className="h-14 w-11 text-lg font-semibold" />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} className="h-14 w-11 text-lg font-semibold" />
          <InputOTPSlot index={4} className="h-14 w-11 text-lg font-semibold" />
          <InputOTPSlot index={5} className="h-14 w-11 text-lg font-semibold" />
        </InputOTPGroup>
      </InputOTP>

      {/* 查找设备按钮 */}
      <Button
        onClick={() => code.length === 6 && void searchDevice(code)}
        disabled={code.length < 6 || isSearching}
        className="w-full bg-blue-600 hover:bg-blue-700"
        size="lg"
      >
        <Search className="size-4" />
        <Trans>查找设备</Trans>
      </Button>
    </div>
  );
}
