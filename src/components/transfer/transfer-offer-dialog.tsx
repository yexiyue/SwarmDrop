/**
 * TransferOfferDialog
 * 传输请求弹窗 - 显示文件预览、保存路径选择、接收/拒绝按钮
 */

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Download, FolderOpen } from "lucide-react";
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
import { useTransferStore } from "@/stores/transfer-store";
import { acceptReceive, rejectReceive } from "@/commands/transfer";
import { FileTree } from "@/routes/_app/send/-components/file-tree";
import { buildTreeDataFromOffer } from "@/routes/_app/send/-file-tree";
import { open } from "@tauri-apps/plugin-dialog";
import { downloadDir } from "@tauri-apps/api/path";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import type { TransferOfferEvent } from "@/commands/transfer";

// 静态配置放在模块级别，避免每次渲染重新创建
const DEFAULT_SAVE_PATH_SUFFIX = "SwarmDrop";

export function TransferOfferDialog() {
  const navigate = useNavigate();
  const [currentOffer, setCurrentOffer] = useState<TransferOfferEvent | null>(null);
  const [savePath, setSavePath] = useState("");
  const [processing, setProcessing] = useState(false);

  // 使用细粒度选择器
  const shiftOffer = useTransferStore(useCallback((s) => s.shiftOffer, []));
  const pendingOffers = useTransferStore(useCallback((s) => s.pendingOffers, []));
  const addSession = useTransferStore(useCallback((s) => s.addSession, []));

  // 初始化默认保存路径
  useEffect(() => {
    let cancelled = false;
    downloadDir().then((dir) => {
      if (!cancelled) {
        setSavePath(`${dir}${DEFAULT_SAVE_PATH_SUFFIX}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 从队列取出第一个 offer
  useEffect(() => {
    if (currentOffer === null && pendingOffers.length > 0) {
      const offer = shiftOffer();
      if (offer) setCurrentOffer(offer);
    }
  }, [currentOffer, pendingOffers, shiftOffer]);

  const treeData = useMemo(() => {
    if (!currentOffer) return null;
    return buildTreeDataFromOffer(currentOffer.files);
  }, [currentOffer]);

  const handleChangePath = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) {
      setSavePath(selected);
    }
  }, []);

  const handleAccept = useCallback(async () => {
    if (!currentOffer) return;
    setProcessing(true);
    try {
      await acceptReceive(currentOffer.sessionId, savePath);

      addSession({
        sessionId: currentOffer.sessionId,
        direction: "receive",
        peerId: currentOffer.peerId,
        deviceName: currentOffer.deviceName,
        files: currentOffer.files,
        totalSize: currentOffer.totalSize,
        status: "transferring",
        progress: null,
        error: null,
        startedAt: Date.now(),
        completedAt: null,
        savePath,
      });

      // 关闭当前弹窗并跳转到详情页
      setCurrentOffer(null);
      void navigate({
        to: "/transfer/$sessionId",
        params: { sessionId: currentOffer.sessionId },
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setProcessing(false);
    }
  }, [currentOffer, savePath, addSession, navigate]);

  const handleReject = useCallback(async () => {
    if (!currentOffer) return;
    setProcessing(true);
    try {
      await rejectReceive(currentOffer.sessionId);
      setCurrentOffer(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  }, [currentOffer]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !processing) {
        void handleReject();
      }
    },
    [processing, handleReject],
  );

  if (!currentOffer || !treeData) return null;

  return (
    <ResponsiveDialog open={true} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent
        className="sm:max-w-lg"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <ResponsiveDialogHeader className="flex flex-col items-center gap-2">
          <div className="flex size-14 items-center justify-center rounded-full bg-blue-100">
            <Download className="size-7 text-blue-600" />
          </div>
          <ResponsiveDialogTitle className="text-center text-xl">
            <Trans>收到文件</Trans>
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-center">
            <Trans>来自 {currentOffer.deviceName}</Trans>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* 文件树预览 */}
        <div className="max-h-[300px] overflow-auto">
          <FileTree
            mode="select"
            dataLoader={treeData.dataLoader}
            rootChildren={treeData.rootChildren}
            totalCount={currentOffer.files.length}
            totalSize={currentOffer.totalSize}
          />
        </div>

        {/* 保存路径 */}
        <SavePathSelector
          savePath={savePath}
          onChangePath={handleChangePath}
          disabled={processing}
        />

        <ResponsiveDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={processing}
            className="flex-1"
          >
            <Trans>拒绝</Trans>
          </Button>
          <Button
            onClick={handleAccept}
            disabled={processing}
            className="flex-1"
          >
            {processing ? <Trans>处理中...</Trans> : <Trans>接收</Trans>}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// 拆分为独立组件，避免不必要的渲染
const SavePathSelector = memo(function SavePathSelector({
  savePath,
  onChangePath,
  disabled,
}: {
  savePath: string;
  onChangePath: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        <Trans>保存到</Trans>
      </span>
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
        <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {savePath}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 shrink-0 px-2 text-xs"
          onClick={onChangePath}
          disabled={disabled}
        >
          <Trans>更改</Trans>
        </Button>
      </div>
    </div>
  );
});
