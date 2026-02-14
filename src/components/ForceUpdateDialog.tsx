/**
 * ForceUpdateDialog
 * 强制更新弹窗 — 不可关闭，阻断应用使用
 * 桌面端：立即更新（原地下载安装）
 * 移动端：前往下载（跳转浏览器）
 */

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  Download,
  ExternalLink,
  Info,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { type } from "@tauri-apps/plugin-os";
import {
  useUpdateStore,
  type DownloadProgress,
} from "@/stores/update-store";
import { Progress } from "@/components/ui/progress";

/** 格式化字节数 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ForceUpdateDialog() {
  const status = useUpdateStore((s) => s.status);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const minVersion = useUpdateStore((s) => s.minVersion);
  const progress = useUpdateStore((s) => s.progress);
  const downloadAndInstall = useUpdateStore((s) => s.downloadAndInstall);
  const openDownloadPage = useUpdateStore((s) => s.openDownloadPage);

  // 仅在 force-required 或正在从强制更新下载时显示
  if (status !== "force-required" && status !== "downloading") return null;
  // 如果是普通下载（非强制更新触发），不显示弹窗
  if (status === "downloading" && !minVersion) return null;

  const isMobile = type() === "android" || type() === "ios";
  const isDownloading = status === "downloading";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-6">
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl bg-background shadow-2xl">
        {isDownloading ? (
          <DownloadingContent
            latestVersion={latestVersion}
            progress={progress}
          />
        ) : (
          <ForceUpdateContent
            currentVersion={currentVersion}
            latestVersion={latestVersion}
            minVersion={minVersion}
            isMobile={isMobile}
            onUpdate={isMobile ? openDownloadPage : downloadAndInstall}
          />
        )}
      </div>
    </div>
  );
}

/** 强制更新初始内容（版本信息 + 操作按钮） */
function ForceUpdateContent({
  currentVersion,
  latestVersion,
  minVersion,
  isMobile,
  onUpdate,
}: {
  currentVersion: string | null;
  latestVersion: string | null;
  minVersion: string | null;
  isMobile: boolean;
  onUpdate: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-center gap-3.5 px-6 pt-7 pb-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
          <ShieldAlert className="size-7 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-foreground">
          <Trans>需要更新</Trans>
        </h2>
        <p className="text-center text-sm text-muted-foreground">
          <Trans>当前版本过旧，无法正常使用</Trans>
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 px-6">
        {/* Version Info Card */}
        <div className="flex flex-col gap-2 rounded-lg bg-muted p-3">
          <VersionRow
            label={t`当前版本`}
            value={`v${currentVersion ?? "?"}`}
          />
          <VersionRow
            label={t`最低要求`}
            value={`v${minVersion ?? "?"}`}
            valueClassName="font-semibold text-red-600 dark:text-red-400"
          />
          <VersionRow
            label={t`最新版本`}
            value={`v${latestVersion ?? "?"}`}
            valueClassName="font-semibold text-green-600 dark:text-green-400"
          />
        </div>

        {/* Warning */}
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/50">
          <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-xs text-amber-800 dark:text-amber-300">
            <Trans>P2P 协议已变更，旧版本无法与其他设备通信</Trans>
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6">
        <button
          type="button"
          onClick={onUpdate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-red-700"
        >
          {isMobile ? (
            <>
              <ExternalLink className="size-[18px]" />
              <Trans>前往下载</Trans>
            </>
          ) : (
            <>
              <Download className="size-[18px]" />
              <Trans>立即更新</Trans>
            </>
          )}
        </button>
      </div>
    </>
  );
}

/** 下载进度内容 */
function DownloadingContent({
  latestVersion,
  progress,
}: {
  latestVersion: string | null;
  progress: DownloadProgress | null;
}) {
  const percent = progress?.percent ?? 0;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-center gap-3.5 px-6 pt-7 pb-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
          <Download className="size-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-foreground">
          <Trans>正在更新</Trans>
        </h2>
        <p className="text-center text-sm text-muted-foreground">
          <Trans>正在下载最新版本，请勿关闭应用</Trans>
        </p>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-2 px-6">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-foreground">
            {t`正在下载 v${latestVersion ?? "?"}`}
          </span>
          <span className="text-[13px] font-semibold text-primary">
            {percent}%
          </span>
        </div>
        <Progress value={percent} className="h-2" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatBytes(progress?.downloaded ?? 0)} /{" "}
            {formatBytes(progress?.total ?? 0)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatBytes(progress?.speed ?? 0)}/s
          </span>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-center justify-center gap-1.5 p-6">
        <Info className="size-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          <Trans>下载完成后将自动安装并重启</Trans>
        </span>
      </div>
    </>
  );
}

/** 版本信息行 */
function VersionRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={`text-[13px] ${valueClassName ?? "font-medium text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
