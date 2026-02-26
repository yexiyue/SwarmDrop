/**
 * Prompt Update Dialog
 * 提示升级弹窗 - 用户可选择更新或稍后提醒
 */

import { Loader2, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useUpgradeLinkStore } from "@/stores/upgrade-link-store";
import { useShallow } from "zustand/react/shallow";
import { Trans } from "@lingui/react/macro";

interface PromptUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromptUpdateDialog({
  open,
  onOpenChange,
}: PromptUpdateDialogProps) {
  const {
    status,
    latestVersion,
    currentVersion,
    releaseNotes,
    progress,
    executeUpdate,
  } = useUpgradeLinkStore(
    useShallow((s) => ({
      status: s.status,
      latestVersion: s.latestVersion,
      currentVersion: s.currentVersion,
      releaseNotes: s.releaseNotes,
      progress: s.progress,
      executeUpdate: s.executeUpdate,
    })),
  );

  const isDownloading = status === "downloading";
  const isReady = status === "ready";

  const handleLater = () => {
    // 仅关闭弹窗，不清空状态，保留更新提示在设置页面
    onOpenChange(false);
  };

  const handleUpdate = async () => {
    onOpenChange(false);
    await executeUpdate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5 text-blue-600" />
            <Trans>发现新版本</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              新版本 {latestVersion} 可用，当前版本 {currentVersion}
            </Trans>
          </DialogDescription>
        </DialogHeader>

        {releaseNotes && (
          <div className="rounded-lg bg-muted p-4">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                <Trans>更新内容</Trans>
              </span>
            </div>
            <div className="max-h-32 overflow-y-auto text-sm leading-relaxed text-foreground">
              {releaseNotes}
            </div>
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

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleLater}
            disabled={isDownloading || isReady}
          >
            <Trans>稍后提醒</Trans>
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={isDownloading || isReady}
            className="bg-blue-600 hover:bg-blue-700"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
