/**
 * Send Page (Lazy)
 * 发送文件页面 — 从设备页面点击发送跳转至此
 */

import { useMemo, useState } from "react";
import {
  createLazyFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Trans } from "@lingui/react/macro";
import type { Device } from "@/commands/network";
import type { FileSource } from "@/commands/transfer";
import { prepareSend, startSend } from "@/commands/transfer";
import { useTransferStore } from "@/stores/transfer-store";
import { useNetworkStore } from "@/stores/network-store";
import { useSecretStore } from "@/stores/secret-store";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useFileSelection } from "./-use-file-selection";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "./-components/file-drop-zone";
import { FileTree } from "./-components/file-tree";

export const Route = createLazyFileRoute("/_app/send/")({
  component: SendPage,
});

function SendPage() {
  const { peerId } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  const fileSelection = useFileSelection();
  const [sending, setSending] = useState(false);

  // 从 network-store / secret-store 查找目标设备
  const onlineDevice = useNetworkStore(
    (s) => s.devices.find((d) => d.peerId === peerId) ?? null,
  );
  const pairedDevices = useSecretStore((s) => s.pairedDevices);

  const device = useMemo<Device | null>(() => {
    if (onlineDevice) return onlineDevice;
    const stored = pairedDevices.find((p) => p.peerId === peerId);
    if (!stored) return null;
    return {
      peerId: stored.peerId,
      hostname: stored.hostname,
      os: stored.os,
      platform: stored.platform,
      arch: stored.arch,
      status: "offline" as const,
      isPaired: true,
    };
  }, [onlineDevice, pairedDevices, peerId]);

  const handleSourcesSelected = async (sources: FileSource[]) => {
    try {
      await fileSelection.addSources(sources);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSend = async () => {
    if (!device || !fileSelection.hasFiles) return;

    setSending(true);
    try {
      // 将扫描到的文件列表传给后端计算 hash
      const scannedFiles = fileSelection.getScannedFiles();
      const prepared = await prepareSend(scannedFiles);
      const fileIds = prepared.files.map((f) => f.fileId);
      const result = await startSend(
        prepared.preparedId,
        device.peerId,
        fileIds,
      );

      if (!result.accepted) {
        toast.error(result.reason ?? "对方拒绝了传输请求");
        return;
      }

      useTransferStore.getState().addSession({
        sessionId: result.sessionId,
        direction: "send",
        peerId: device.peerId,
        deviceName: device.hostname,
        files: prepared.files,
        totalSize: prepared.totalSize,
        status: "transferring",
        progress: null,
        error: null,
        startedAt: Date.now(),
        completedAt: null,
      });

      void navigate({ to: "/transfer" });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    if (router.history.length > 1) {
      router.history.back();
    } else {
      void navigate({ to: "/devices" });
    }
  };

  if (!device) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">
          <Trans>设备未找到</Trans>
        </p>
        <Button variant="outline" onClick={handleBack}>
          <Trans>返回</Trans>
        </Button>
      </main>
    );
  }

  if (isMobile) {
    return (
      <MobileSendView
        device={device}
        fileSelection={fileSelection}
        sending={sending}
        onSourcesSelected={handleSourcesSelected}
        onSend={handleSend}
        onBack={handleBack}
      />
    );
  }

  return (
    <DesktopSendView
      device={device}
      fileSelection={fileSelection}
      sending={sending}
      onSourcesSelected={handleSourcesSelected}
      onSend={handleSend}
      onBack={handleBack}
    />
  );
}

/* ─────────────────── 共享 Props ─────────────────── */

interface SendViewProps {
  device: Device;
  fileSelection: ReturnType<typeof useFileSelection>;
  sending: boolean;
  onSourcesSelected: (sources: FileSource[]) => void;
  onSend: () => void;
  onBack: () => void;
}

/* ─────────────────── 共享内容区 ─────────────────── */

function SendContent({
  fileSelection,
  sending,
  onSourcesSelected,
}: Pick<SendViewProps, "fileSelection" | "sending" | "onSourcesSelected">) {
  return (
    <>
      <FileDropZone onSourcesSelected={onSourcesSelected} disabled={sending} />
      {fileSelection.hasFiles && (
        <FileTree
          mode="select"
          dataLoader={fileSelection.dataLoader}
          rootChildren={fileSelection.rootChildren}
          totalCount={fileSelection.totalCount}
          totalSize={fileSelection.totalSize}
          onRemoveFile={fileSelection.removeFile}
        />
      )}
    </>
  );
}

/* ─────────────────── 移动端视图 ─────────────────── */

function MobileSendView({
  device,
  fileSelection,
  sending,
  onSourcesSelected,
  onSend,
  onBack,
}: SendViewProps) {
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
            <Trans>发送文件</Trans>
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            <Trans>到 {device.hostname}</Trans>
          </p>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="flex flex-col gap-4">
          <SendContent
            fileSelection={fileSelection}
            sending={sending}
            onSourcesSelected={onSourcesSelected}
          />
        </div>
      </div>

      {/* 底部发送按钮 */}
      <div className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          className="w-full"
          size="lg"
          onClick={onSend}
          disabled={!fileSelection.hasFiles || sending}
        >
          {sending ? <Trans>发送中...</Trans> : <Trans>发送</Trans>}
        </Button>
      </div>
    </main>
  );
}

/* ─────────────────── 桌面端视图 ─────────────────── */

function DesktopSendView({
  device,
  fileSelection,
  sending,
  onSourcesSelected,
  onSend,
  onBack,
}: SendViewProps) {
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
          <Trans>发送文件到 {device.hostname}</Trans>
        </h1>
      </header>

      {/* Content */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 overflow-hidden p-5 lg:p-6">
        {/* 可滚动区域：拖放区 + 文件树 */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto">
          <FileDropZone onSourcesSelected={onSourcesSelected} disabled={sending} />
          {fileSelection.hasFiles && (
            <FileTree
              mode="select"
              dataLoader={fileSelection.dataLoader}
              rootChildren={fileSelection.rootChildren}
              totalCount={fileSelection.totalCount}
              totalSize={fileSelection.totalSize}
              onRemoveFile={fileSelection.removeFile}
            />
          )}
        </div>

        {/* 操作栏：固定在底部 */}
        <div className="flex shrink-0 justify-end gap-3">
          <Button variant="outline" onClick={onBack} disabled={sending}>
            <Trans>取消</Trans>
          </Button>
          <Button
            onClick={onSend}
            disabled={!fileSelection.hasFiles || sending}
          >
            {sending ? <Trans>发送中...</Trans> : <Trans>发送</Trans>}
          </Button>
        </div>
      </div>
    </main>
  );
}
