/**
 * Network Node Dialog
 * 网络节点控制对话框
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useNetworkStore, type NodeStatus } from "@/stores/network-store";
import { useShallow } from "zustand/shallow";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface NetworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<
  NodeStatus,
  { label: MessageDescriptor; dotColor: string; className: string }
> = {
  stopped: {
    label: msg`未启动`,
    dotColor: "bg-muted-foreground",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  starting: {
    label: msg`启动中`,
    dotColor: "bg-yellow-500 animate-pulse",
    className: "bg-yellow-500/10 text-yellow-600 border-transparent",
  },
  running: {
    label: msg`运行中`,
    dotColor: "bg-green-500",
    className: "bg-green-500/10 text-green-600 border-transparent",
  },
  error: {
    label: msg`错误`,
    dotColor: "bg-red-500",
    className: "bg-red-500/10 text-red-600 border-transparent",
  },
};

export function NetworkDialog({ open, onOpenChange }: NetworkDialogProps) {
  const { t } = useLingui();
  const {
    status,
    networkStatus,
    error,
    startNetwork,
    stopNetwork,
    getConnectedCount,
    getDiscoveredCount,
  } = useNetworkStore(
    useShallow((state) => ({
      status: state.status,
      networkStatus: state.networkStatus,
      error: state.error,
      startNetwork: state.startNetwork,
      stopNetwork: state.stopNetwork,
      getConnectedCount: state.getConnectedCount,
      getDiscoveredCount: state.getDiscoveredCount,
    }))
  );

  const listenAddrs = networkStatus?.listenAddrs ?? [];

  const config = statusConfig[status];
  const isRunning = status === "running";
  const isStarting = status === "starting";

  const handleAction = async () => {
    if (isRunning) {
      await stopNetwork();
    } else if (!isStarting) {
      await startNetwork();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-105">
        <DialogHeader>
          <DialogTitle>
            <Trans>网络节点</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>管理 P2P 网络节点的启动和连接状态</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Status Row */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              <Trans>节点状态</Trans>
            </span>
            <Badge variant="outline" className={cn("gap-1.5", config.className)}>
              <span className={cn("size-2 rounded-full", config.dotColor)} />
              {t(config.label)}
            </Badge>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Listening Addresses */}
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">
              <Trans>监听地址</Trans>
            </span>
            <Card className="gap-0 bg-muted/50 py-0">
              <CardContent className="p-3">
                {listenAddrs.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {listenAddrs.map((addr, i) => (
                      <code
                        key={i}
                        className={cn(
                          "font-mono text-xs",
                          i === 0 ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {addr}
                      </code>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    <Trans>节点未启动</Trans>
                  </span>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="gap-0 bg-muted/50 py-0">
              <CardContent className="flex flex-col gap-1 p-3">
                <span className="text-xs text-muted-foreground">
                  <Trans>已连接节点</Trans>
                </span>
                <span className="text-2xl font-semibold text-foreground">
                  {getConnectedCount()}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-0 bg-muted/50 py-0">
              <CardContent className="flex flex-col gap-1 p-3">
                <span className="text-xs text-muted-foreground">
                  <Trans>已发现节点</Trans>
                </span>
                <span className="text-2xl font-semibold text-foreground">
                  {getDiscoveredCount()}
                </span>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          {isRunning ? (
            <Button variant="destructive" onClick={handleAction}>
              <Trans>停止节点</Trans>
            </Button>
          ) : (
            <Button onClick={handleAction} disabled={isStarting}>
              {isStarting ? <Trans>启动中...</Trans> : <Trans>启动节点</Trans>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
