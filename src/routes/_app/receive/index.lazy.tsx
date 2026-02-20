/**
 * Receive Page (Lazy)
 * 接收文件页面 — 收到传输提议时自动导航到此页面
 */

import { useEffect, useMemo, useState } from "react";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { pickFolder, getDefaultSavePath } from "@/lib/file-picker";
import { FolderOpen, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Trans } from "@lingui/react/macro";
import type { TransferOfferEvent } from "@/commands/transfer";
import { acceptReceive, rejectReceive } from "@/commands/transfer";
import { useTransferStore } from "@/stores/transfer-store";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { buildTreeDataFromOffer } from "@/routes/_app/send/-file-tree";
import { FileTree } from "@/routes/_app/send/-components/file-tree";

export const Route = createLazyFileRoute("/_app/receive/")({
  component: ReceivePage,
});

function ReceivePage() {
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  const shiftOffer = useTransferStore((s) => s.shiftOffer);
  const pendingCount = useTransferStore((s) => s.pendingOffers.length);

  const [currentOffer, setCurrentOffer] = useState<TransferOfferEvent | null>(
    null,
  );
  const [savePath, setSavePath] = useState("");
  const [processing, setProcessing] = useState(false);

  // 初始化默认保存路径
  useEffect(() => {
    getDefaultSavePath().then(setSavePath);
  }, []);

  // 从队列取出第一个 offer
  useEffect(() => {
    if (currentOffer === null && pendingCount > 0) {
      const offer = shiftOffer();
      if (offer) setCurrentOffer(offer);
    }
  }, [currentOffer, pendingCount, shiftOffer]);

  // 无 offer 时返回传输列表
  useEffect(() => {
    if (currentOffer !== null || pendingCount > 0) return;

    // 延迟检查，避免初始化时立即跳转
    const timer = setTimeout(() => {
      const { pendingOffers: latest } = useTransferStore.getState();
      if (latest.length === 0) {
        void navigate({ to: "/transfer" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [currentOffer, pendingCount, navigate]);

  const handleChangePath = async () => {
    const selected = await pickFolder();
    if (selected) {
      setSavePath(selected);
    }
  };

  const handleAccept = async () => {
    if (!currentOffer) return;
    setProcessing(true);
    try {
      await acceptReceive(currentOffer.sessionId, savePath);

      useTransferStore.getState().addSession({
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

      // 处理下一个 offer 或跳转到传输列表
      setCurrentOffer(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
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
  };

  const handleBack = () => {
    if (currentOffer) {
      void handleReject();
    }
    void navigate({ to: "/transfer" });
  };

  // 等待 offer
  if (!currentOffer) {
    return (
      <main className="flex h-full flex-col items-center justify-center">
        <p className="text-sm text-muted-foreground">
          <Trans>等待传输请求...</Trans>
        </p>
      </main>
    );
  }

  if (isMobile) {
    return (
      <MobileReceiveView
        offer={currentOffer}
        savePath={savePath}
        processing={processing}
        onChangePath={handleChangePath}
        onAccept={handleAccept}
        onReject={handleReject}
        onBack={handleBack}
      />
    );
  }

  return (
    <DesktopReceiveView
      offer={currentOffer}
      savePath={savePath}
      processing={processing}
      onChangePath={handleChangePath}
      onAccept={handleAccept}
      onReject={handleReject}
      onBack={handleBack}
    />
  );
}

/* ─────────────────── 共享 Props ─────────────────── */

interface ReceiveViewProps {
  offer: TransferOfferEvent;
  savePath: string;
  processing: boolean;
  onChangePath: () => void;
  onAccept: () => void;
  onReject: () => void;
  onBack: () => void;
}

/* ─────────────────── 保存路径选择 ─────────────────── */

function SavePathPicker({
  savePath,
  onChangePath,
  disabled,
}: {
  savePath: string;
  onChangePath: () => void;
  disabled?: boolean;
}) {
  return (
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
  );
}

/* ─────────────────── 共享内容区 ─────────────────── */

function ReceiveContent({
  offer,
  savePath,
  processing,
  onChangePath,
}: Pick<ReceiveViewProps, "offer" | "savePath" | "processing" | "onChangePath">) {
  const treeData = useMemo(
    () => buildTreeDataFromOffer(offer.files),
    [offer.files],
  );

  return (
    <>
      <FileTree
        mode="select"
        dataLoader={treeData.dataLoader}
        rootChildren={treeData.rootChildren}
        totalCount={offer.files.length}
        totalSize={offer.totalSize}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">
          <Trans>保存到</Trans>
        </span>
        <SavePathPicker
          savePath={savePath}
          onChangePath={onChangePath}
          disabled={processing}
        />
      </div>
    </>
  );
}

/* ─────────────────── 移动端视图 ─────────────────── */

function MobileReceiveView({
  offer,
  savePath,
  processing,
  onChangePath,
  onAccept,
  onReject,
  onBack,
}: ReceiveViewProps) {
  return (
    <main className="flex h-full flex-col bg-background">
      {/* 头部 */}
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-foreground">
            <Trans>收到文件</Trans>
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            <Trans>来自 {offer.deviceName}</Trans>
          </p>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="flex flex-col gap-4">
          <ReceiveContent
            offer={offer}
            savePath={savePath}
            processing={processing}
            onChangePath={onChangePath}
          />
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex gap-3 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onReject}
          disabled={processing}
        >
          <Trans>拒绝</Trans>
        </Button>
        <Button
          className="flex-1"
          onClick={onAccept}
          disabled={processing}
        >
          {processing ? <Trans>处理中...</Trans> : <Trans>接收</Trans>}
        </Button>
      </div>
    </main>
  );
}

/* ─────────────────── 桌面端视图 ─────────────────── */

function DesktopReceiveView({
  offer,
  savePath,
  processing,
  onChangePath,
  onAccept,
  onReject,
  onBack,
}: ReceiveViewProps) {
  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      {/* Toolbar */}
      <header className="flex h-13 items-center gap-2 border-b border-border px-4 lg:px-5">
        <button
          type="button"
          onClick={onBack}
          className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-[15px] font-medium text-foreground">
          <Trans>收到文件</Trans>
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5 lg:p-6">
        <div className="mx-auto flex max-w-lg flex-col gap-5">
          {/* 来自 */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trans>来自：{offer.deviceName}</Trans>
          </div>

          <ReceiveContent
            offer={offer}
            savePath={savePath}
            processing={processing}
            onChangePath={onChangePath}
          />

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onReject}
              disabled={processing}
            >
              <Trans>拒绝</Trans>
            </Button>
            <Button onClick={onAccept} disabled={processing}>
              {processing ? <Trans>处理中...</Trans> : <Trans>接收</Trans>}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
