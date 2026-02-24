/**
 * Force Update Dialog
 * 强制升级弹窗 - 用户必须更新，无法关闭
 */

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useUpgradeLinkStore } from "@/stores/upgrade-link-store";
import { useShallow } from "zustand/react/shallow";
import { Trans } from "@lingui/react/macro";

export function ForceUpdateDialog() {
  const {
    status,
    latestVersion,
    currentVersion,
    promptContent,
    progress,
    executeUpdate,
  } = useUpgradeLinkStore(
    useShallow((s) => ({
      status: s.status,
      latestVersion: s.latestVersion,
      currentVersion: s.currentVersion,
      promptContent: s.promptContent,
      progress: s.progress,
      executeUpdate: s.executeUpdate,
    })),
  );

  const isDownloading = status === "downloading";
  const isReady = status === "ready";

  return (
    <Dialog open={status === "force-required" || isDownloading || isReady}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            <Trans>需要更新</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              当前版本 {currentVersion} 已不再支持，请更新到最新版本 {latestVersion}
            </Trans>
          </DialogDescription>
        </DialogHeader>

        {promptContent && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            {promptContent}
          </div>
        )}

        {isDownloading && progress && (
          <div className="space-y-2">
            <Progress value={progress.percent} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.percent}%</span>
              <span>
                {(progress.speed / 1024 / 1024).toFixed(1)} MB/s
              </span>
            </div>
          </div>
        )}

        <Button
          onClick={executeUpdate}
          disabled={isDownloading || isReady}
          className="w-full"
        >
          {isDownloading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              <Trans>下载中...</Trans>
            </>
          ) : isReady ? (
            <Trans>正在重启...</Trans>
          ) : (
            <Trans>立即更新</Trans>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
