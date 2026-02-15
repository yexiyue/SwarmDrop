/**
 * Mobile Pairing Page (Route)
 * 移动端配对全屏页面（fixed 覆盖底部导航）
 * - Header + Tab 切换（生成配对码 / 输入配对码）
 * - 设备详情视图
 * - 桌面端访问时重定向到 /pairing/generate
 */

import { useState, useEffect } from "react";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trans } from "@lingui/react/macro";
import { useShallow } from "zustand/react/shallow";
import { usePairingStore } from "@/stores/pairing-store";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { MobileGenerateCodeView } from "@/components/pairing/mobile-generate-code-view";
import { MobileInputCodeView } from "@/components/pairing/mobile-input-code-view";
import {
  MobileDeviceFoundView,
  useDeviceFoundState,
} from "@/routes/_app/pairing/-device-found-view";

export const Route = createLazyFileRoute("/_app/pairing/")({
  component: MobilePairingPage,
});

function MobilePairingPage() {
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();

  const { current, generateCode, openInput, sendPairingRequest, reset } =
    usePairingStore(
      useShallow((state) => ({
        current: state.current,
        generateCode: state.generateCode,
        openInput: state.openInput,
        sendPairingRequest: state.sendPairingRequest,
        reset: state.reset,
      }))
    );

  const { showDeviceFound, deviceInfo, isRequesting } = useDeviceFoundState();

  const [activeTab, setActiveTab] = useState<"generate" | "input">("generate");

  // 桌面端重定向到 /pairing/generate
  useEffect(() => {
    if (breakpoint !== "mobile") {
      void navigate({ to: "/pairing/generate", replace: true });
    }
  }, [breakpoint, navigate]);

  // 进入页面时生成配对码
  useEffect(() => {
    void generateCode();
    return () => {
      usePairingStore.getState().reset();
    };
  }, [generateCode]);

  // 配对成功后自动返回
  useEffect(() => {
    if (current.phase === "success") {
      void navigate({ to: "/devices" });
    }
  }, [current.phase, navigate]);

  const handleClose = () => {
    void navigate({ to: "/devices" });
  };

  const handleTabChange = (value: string) => {
    const tab = value as "generate" | "input";
    setActiveTab(tab);
    reset();
    if (tab === "generate") {
      void generateCode();
    } else {
      openInput();
    }
  };

  // 桌面端不渲染（等待重定向）
  if (breakpoint !== "mobile") {
    return null;
  }

  // ─── 设备详情视图 ───
  if (showDeviceFound && deviceInfo) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <MobileDeviceFoundView
          deviceInfo={deviceInfo}
          isRequesting={isRequesting}
          onSendRequest={() => void sendPairingRequest()}
          onBack={reset}
        />
      </div>
    );
  }

  // ─── Tabs 视图 ───
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center gap-1 text-foreground"
        >
          <ArrowLeft className="size-5" />
          <span className="text-lg font-semibold">
            <Trans>添加设备</Trans>
          </span>
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="flex size-8 items-center justify-center text-muted-foreground"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-1 flex-col px-4"
      >
        <TabsList className="w-full">
          <TabsTrigger value="generate" className="flex-1">
            <Trans>生成配对码</Trans>
          </TabsTrigger>
          <TabsTrigger value="input" className="flex-1">
            <Trans>输入配对码</Trans>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="flex flex-1 flex-col">
          <MobileGenerateCodeView />
        </TabsContent>
        <TabsContent value="input" className="flex flex-1 flex-col">
          <MobileInputCodeView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
