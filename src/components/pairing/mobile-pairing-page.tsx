/**
 * MobilePairingPage
 * 移动端配对全屏页面：Header + Tab 切换（生成配对码 / 输入配对码）
 */

import { useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trans } from "@lingui/react/macro";
import { usePairingStore } from "@/stores/pairing-store";
import { MobileGenerateCodeView } from "@/components/pairing/mobile-generate-code-view";
import { MobileInputCodeView } from "@/components/pairing/mobile-input-code-view";

export function MobilePairingPage() {
  const closePairingView = usePairingStore((s) => s.closePairingView);
  const generateCode = usePairingStore((s) => s.generateCode);
  const openInput = usePairingStore((s) => s.openInput);
  const reset = usePairingStore((s) => s.reset);

  const [activeTab, setActiveTab] = useState<"generate" | "input">("generate");

  const handleTabChange = (value: string) => {
    const tab = value as "generate" | "input";
    setActiveTab(tab);
    // 切换 Tab 时先重置前一个 Tab 的状态，再触发新 Tab 的初始化
    reset();
    if (tab === "generate") {
      void generateCode();
    } else {
      openInput();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={closePairingView}
          className="flex items-center gap-1 text-foreground"
        >
          <ArrowLeft className="size-5" />
          <span className="text-lg font-semibold">
            <Trans>添加设备</Trans>
          </span>
        </button>
        <button
          type="button"
          onClick={closePairingView}
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

        <TabsContent value="generate" className="flex-1">
          <MobileGenerateCodeView />
        </TabsContent>
        <TabsContent value="input" className="flex-1">
          <MobileInputCodeView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
