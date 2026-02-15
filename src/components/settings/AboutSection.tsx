/**
 * AboutSection
 * 设置页「关于」区域 — 应用信息 + 更新状态展示
 */

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { type } from "@tauri-apps/plugin-os";
import { useUpdateStore, type UpdateStatus } from "@/stores/update-store";
import { useShallow } from "zustand/react/shallow";
import { Progress } from "@/components/ui/progress";

/** 格式化字节数为人类可读 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AboutSection() {
  const {
    status,
    currentVersion,
    latestVersion,
    releaseNotes,
    progress,
    checkForUpdate,
    downloadAndInstall,
    openDownloadPage,
  } = useUpdateStore(
    useShallow((s) => ({
      status: s.status,
      currentVersion: s.currentVersion,
      latestVersion: s.latestVersion,
      releaseNotes: s.releaseNotes,
      progress: s.progress,
      checkForUpdate: s.checkForUpdate,
      downloadAndInstall: s.downloadAndInstall,
      openDownloadPage: s.openDownloadPage,
    })),
  );

  const isMobile = type() === "android" || type() === "ios";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">
        <Trans>关于</Trans>
      </h2>
      <div className="overflow-hidden rounded-lg border border-border">
        {/* App Info Row - 桌面端 space-between，支持自动换行 */}
        <div className="flex flex-col gap-4 p-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
          {/* 应用信息 */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500">
              <Zap className="size-[22px] text-white" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-foreground">
                SwarmDrop
              </span>
              <span className="text-xs text-muted-foreground">
                <VersionDescription
                  status={status}
                  currentVersion={currentVersion}
                />
              </span>
            </div>
          </div>

          {/* 分隔线 - 仅小屏幕显示，占满容器宽度 */}
          <div className="relative left-[-1rem] block w-[calc(100%+2rem)] border-t border-border min-[480px]:hidden" />

          {/* 按钮组 - 桌面端显示两个按钮，移动端简化 */}
          {isMobile ? (
            <MobileUpdateButton
              status={status}
              latestVersion={latestVersion}
              onCheck={checkForUpdate}
              onOpenPage={openDownloadPage}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-around gap-2 min-[480px]:justify-end">
              <ReleaseNotesButton />
              <DesktopUpdateButton
                status={status}
                latestVersion={latestVersion}
                onCheck={checkForUpdate}
                onDownload={downloadAndInstall}
              />
            </div>
          )}
        </div>

        {/* Update Banner / Progress */}
        {status === "available" && releaseNotes && (
          <UpdateBanner
            latestVersion={latestVersion}
            releaseNotes={releaseNotes}
          />
        )}
        {status === "downloading" && progress && (
          <DownloadProgressBanner
            latestVersion={latestVersion}
            progress={progress}
          />
        )}
      </div>
    </section>
  );
}

/** 版本描述文字 */
function VersionDescription({
  status,
  currentVersion,
}: {
  status: UpdateStatus;
  currentVersion: string | null;
}) {
  const ver = currentVersion ? `v${currentVersion}` : "";
  switch (status) {
    case "checking":
      return <Trans>版本 {ver} · 检查中...</Trans>;
    case "available":
      return <Trans>版本 {ver} · 有新版本可用</Trans>;
    case "downloading":
      return <Trans>版本 {ver} · 正在更新...</Trans>;
    case "up-to-date":
      return <Trans>版本 {ver} · 已是最新版本</Trans>;
    case "error":
      return <Trans>版本 {ver} · 检查失败</Trans>;
    default:
      return <Trans>版本 {ver}</Trans>;
  }
}

/** 桌面端：更新日志按钮 */
function ReleaseNotesButton() {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
    >
      <ExternalLink className="size-3.5" />
      <Trans>更新日志</Trans>
    </button>
  );
}

/** 桌面端：更新操作按钮 */
function DesktopUpdateButton({
  status,
  latestVersion,
  onCheck,
  onDownload,
}: {
  status: UpdateStatus;
  latestVersion: string | null;
  onCheck: () => void;
  onDownload: () => void;
}) {
  switch (status) {
    case "checking":
      return (
        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 rounded-md bg-primary/50 px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          <Loader2 className="size-3.5 animate-spin" />
          <Trans>检查中...</Trans>
        </button>
      );

    case "available":
      return (
        <button
          type="button"
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Download className="size-3.5" />
          {t`更新到 v${latestVersion ?? "?"}`}
        </button>
      );

    case "downloading":
      return (
        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Loader2 className="size-3.5 animate-spin" />
          <Trans>下载中...</Trans>
        </button>
      );

    default:
      return (
        <button
          type="button"
          onClick={onCheck}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="size-3.5" />
          <Trans>检查更新</Trans>
        </button>
      );
  }
}

/** 移动端：简化更新按钮（无更新日志按钮） */
function MobileUpdateButton({
  status,
  latestVersion,
  onCheck,
  onOpenPage,
}: {
  status: UpdateStatus;
  latestVersion: string | null;
  onCheck: () => void;
  onOpenPage: () => void;
}) {
  switch (status) {
    case "checking":
      return (
        <button
          type="button"
          disabled
          className="flex items-center gap-1 rounded-md bg-primary/50 px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground"
        >
          <Loader2 className="size-3 animate-spin" />
          <Trans>检查中</Trans>
        </button>
      );

    case "available":
      return (
        <button
          type="button"
          onClick={onOpenPage}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ExternalLink className="size-3" />
          {latestVersion ? (
            <span>v{latestVersion}</span>
          ) : (
            <Trans>前往下载</Trans>
          )}
        </button>
      );

    case "downloading":
      return (
        <button
          type="button"
          disabled
          className="flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground"
        >
          <Loader2 className="size-3 animate-spin" />
          <Trans>下载中</Trans>
        </button>
      );

    default:
      return (
        <button
          type="button"
          onClick={onCheck}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="size-3" />
          <Trans>检查更新</Trans>
        </button>
      );
  }
}

/** 有更新可用时的蓝色 banner */
function UpdateBanner({
  latestVersion,
  releaseNotes,
}: {
  latestVersion: string | null;
  releaseNotes: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/50">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-blue-600 dark:text-blue-400" />
        <span className="text-[13px] font-semibold text-blue-700 dark:text-blue-300">
          {t`SwarmDrop v${latestVersion ?? "?"} 已发布`}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-blue-600 dark:text-blue-400">
        {releaseNotes}
      </p>
    </div>
  );
}

/** 下载进度 banner */
function DownloadProgressBanner({
  latestVersion,
  progress,
}: {
  latestVersion: string | null;
  progress: { downloaded: number; total: number; speed: number; percent: number };
}) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-foreground">
          {t`正在下载 v${latestVersion ?? "?"}`}
        </span>
        <span className="text-[13px] font-semibold text-primary">
          {progress.percent}%
        </span>
      </div>
      <Progress value={progress.percent} className="h-1.5" />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {formatBytes(progress.speed)}/s
        </span>
      </div>
    </div>
  );
}
