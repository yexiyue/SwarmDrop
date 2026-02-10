/**
 * ConnectionRequestDialog
 * 收到配对请求弹窗：显示对方设备信息 + 安全提示 + 接受/拒绝
 */

import { ShieldCheck, Monitor, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/responsive-dialog";
import { Trans } from "@lingui/react/macro";
import { usePairingStore } from "@/stores/pairing-store";
import { getDeviceIcon } from "@/components/pairing/device-icon";

export function ConnectionRequestDialog() {
  const current = usePairingStore((s) => s.current);
  const acceptRequest = usePairingStore((s) => s.acceptRequest);
  const rejectRequest = usePairingStore((s) => s.rejectRequest);

  const isOpen = current.phase === "incoming";
  const request = current.phase === "incoming" ? current.request : null;

  const DeviceIcon = request ? getDeviceIcon(request.osInfo.os) : Monitor;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      void rejectRequest();
    }
  };

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md" showCloseButton={false}>
        <ResponsiveDialogHeader className="flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <ResponsiveDialogTitle className="text-center text-xl">
            <Trans>连接请求</Trans>
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-center">
            <Trans>一台设备正在请求与您配对</Trans>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {request && (
          <div className="flex flex-col items-center gap-4 py-2">
            {/* 设备信息 */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <DeviceIcon className="size-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {request.osInfo.hostname}
                </span>
                <span className="text-xs text-muted-foreground">
                  {request.osInfo.platform} · {request.osInfo.os}
                </span>
              </div>
            </div>

            {/* 安全提示 */}
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p className="text-xs">
                <Trans>
                  配对后，该设备可以向您发送文件。请确认您认识此设备。
                </Trans>
              </p>
            </div>
          </div>
        )}

        <ResponsiveDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
          <Button variant="outline" onClick={() => void rejectRequest()}>
            <Trans>拒绝</Trans>
          </Button>
          <Button onClick={() => void acceptRequest()}>
            <Trans>接受配对</Trans>
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
