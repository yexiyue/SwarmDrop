/**
 * TransferSettingsSection
 * 设置页「文件传输」区域 — 传输相关设置
 */

import { useCallback, useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { FolderOpen } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useShallow } from "zustand/react/shallow";
import { usePreferencesStore } from "@/stores/preferences-store";
import { downloadDir, homeDir, join } from "@tauri-apps/api/path";
import { pickFolderWithDefault } from "@/hooks/use-android-fs";

export function TransferSettingsSection() {
  const { savePath, autoAccept, setTransferSavePath, setTransferAutoAccept } =
    usePreferencesStore(
      useShallow((state) => ({
        savePath: state.transfer.savePath,
        autoAccept: state.transfer.autoAccept,
        setTransferSavePath: state.setTransferSavePath,
        setTransferAutoAccept: state.setTransferAutoAccept,
      })),
    );

  const [displayPath, setDisplayPath] = useState("<未设置>");

  // 初始化默认保存路径
  useEffect(() => {
    if (!savePath) {
      downloadDir().then(async (dir) => {
        if (dir) {
          const defaultPath = await join(dir, "SwarmDrop");
          setTransferSavePath(defaultPath);
        }
      });
    }
  }, [savePath, setTransferSavePath]);

  // 更新显示路径（使用 homeDir API 简化路径显示）
  useEffect(() => {
    if (savePath) {
      homeDir().then((home) => {
        if (home && savePath.startsWith(home)) {
          // 将用户目录前缀替换为 ~
          const relative = savePath.slice(home.length).replace(/\\/g, "/");
          setDisplayPath(`~${relative}`);
        } else {
          setDisplayPath(savePath);
        }
      });
    }
  }, [savePath]);

  const handleChangePath = useCallback(async () => {
    const selected = await pickFolderWithDefault(savePath);
    if (selected) {
      setTransferSavePath(selected);
    }
  }, [savePath, setTransferSavePath]);

  const handleAutoAcceptChange = useCallback(
    (checked: boolean) => {
      setTransferAutoAccept(checked);
    },
    [setTransferAutoAccept],
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">
        <Trans>文件传输</Trans>
      </h2>
      <div className="rounded-lg border border-border">
        {/* 保存位置 */}
        <button
          type="button"
          onClick={handleChangePath}
          className="flex w-full items-center justify-between border-b border-border p-4 text-left hover:bg-accent/50"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              <Trans>保存位置</Trans>
            </span>
            <span className="text-xs text-muted-foreground">
              <Trans>接收文件的默认保存位置</Trans>
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
            <FolderOpen className="size-4 text-muted-foreground" />
            <span className="max-w-[150px] truncate text-sm text-foreground sm:max-w-[200px]">
              {displayPath}
            </span>
          </div>
        </button>

        {/* 自动接收 */}
        <div className="flex items-center justify-between p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              <Trans>自动接收</Trans>
            </span>
            <span className="text-xs text-muted-foreground">
              <Trans>自动接受已配对设备的文件</Trans>
            </span>
          </div>
          <Switch checked={autoAccept} onCheckedChange={handleAutoAcceptChange} />
        </div>
      </div>
    </section>
  );
}
