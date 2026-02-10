/**
 * StartNodeSheet
 * 启动节点确认弹窗（移动端 Bottom Sheet / 桌面端 Dialog）
 */

import { Globe, Radar, Shield, Play } from "lucide-react";
import { useNetworkStore } from "@/stores/network-store";
import { useShallow } from "zustand/shallow";
import { Trans } from "@lingui/react/macro";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/responsive-dialog";
import { useResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

interface StartNodeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const features = [
  { icon: Globe, text: "连接到 DHT 引导节点" },
  { icon: Radar, text: "启用局域网设备发现 (mDNS)" },
  { icon: Shield, text: "开启 NAT 穿透和中继" },
] as const;

export function StartNodeSheet({ open, onOpenChange }: StartNodeSheetProps) {
  const { startNetwork, status } = useNetworkStore(
    useShallow((s) => ({
      startNetwork: s.startNetwork,
      status: s.status,
    })),
  );

  const isStarting = status === "starting";

  const handleStart = async () => {
    await startNetwork();
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <StartNodeContent
          onStart={handleStart}
          onCancel={() => onOpenChange(false)}
          isStarting={isStarting}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function StartNodeContent({
  onStart,
  onCancel,
  isStarting,
}: {
  onStart: () => void;
  onCancel: () => void;
  isStarting: boolean;
}) {
  const { isMobile } = useResponsiveDialog();

  if (isMobile) {
    return (
      <div className="flex flex-col gap-5 px-6 pb-8 pt-2">
        {/* Icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-16 items-center justify-center rounded-full bg-blue-100">
            <Play className="size-7 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            <Trans>启动 P2P 节点</Trans>
          </h2>
          <p className="text-center text-sm text-muted-foreground">
            <Trans>
              将连接到 SwarmDrop 网络，{"\n"}其他设备将能够发现你并发送文件。
            </Trans>
          </p>
        </div>

        {/* Feature List */}
        <div className="overflow-hidden rounded-[10px] bg-accent">
          {features.map((feature, i) => (
            <div key={i}>
              {i > 0 && <Separator />}
              <div className="flex items-center gap-3 px-4 py-3">
                <feature.icon className="size-4.5 shrink-0 text-blue-600" />
                <span className="text-sm text-foreground">
                  <Trans>{feature.text}</Trans>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onStart}
            disabled={isStarting}
            className="flex h-12 items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isStarting ? <Trans>启动中...</Trans> : <Trans>启动</Trans>}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 items-center justify-center rounded-xl text-base font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <Trans>取消</Trans>
          </button>
        </div>
      </div>
    );
  }

  // 桌面端：与现有 NetworkDialog 离线布局一致
  return (
    <>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>
          <Trans>网络节点</Trans>
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          <Trans>管理 P2P 网络节点的启动和连接状态</Trans>
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            <Trans>节点状态</Trans>
          </span>
          <Badge
            variant="outline"
            className="gap-1.5 border-transparent bg-muted text-muted-foreground"
          >
            <span className="size-2 rounded-full bg-muted-foreground" />
            <Trans>未启动</Trans>
          </Badge>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">
            <Trans>监听地址</Trans>
          </span>
          <Card className="gap-0 bg-muted/50 py-0">
            <CardContent className="p-3">
              <span className="text-sm text-muted-foreground">
                <Trans>节点未启动</Trans>
              </span>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <Card className="gap-0 bg-muted/50 py-0">
            <CardContent className="flex flex-col gap-1 p-3">
              <span className="text-xs text-muted-foreground">
                <Trans>已连接节点</Trans>
              </span>
              <span className="text-2xl font-semibold text-foreground">0</span>
            </CardContent>
          </Card>
          <Card className="gap-0 bg-muted/50 py-0">
            <CardContent className="flex flex-col gap-1 p-3">
              <span className="text-xs text-muted-foreground">
                <Trans>已发现节点</Trans>
              </span>
              <span className="text-2xl font-semibold text-foreground">0</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <ResponsiveDialogFooter>
        <Button onClick={onStart} disabled={isStarting}>
          {isStarting ? <Trans>启动中...</Trans> : <Trans>启动节点</Trans>}
        </Button>
      </ResponsiveDialogFooter>
    </>
  );
}
