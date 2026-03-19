/**
 * Devices Page (Lazy)
 * 设备页面 - 懒加载组件
 * 根据断点渲染移动端/桌面端不同布局
 */

import { memo, useMemo, useState, useCallback } from "react";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { DeviceCard } from "./-components/device-card";
import type { Device } from "@/commands/network";
import { Trans } from "@lingui/react/macro";
import { useNetworkStore } from "@/stores/network-store";
import { useSecretStore } from "@/stores/secret-store";
import { usePairingStore } from "@/stores/pairing-store";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { usePairingSuccess } from "@/hooks/use-pairing-success";
import { removePairedDevice } from "@/commands/pairing";
import { AddDeviceMenu } from "./-components/add-device-menu";
import { NetworkStatusBar } from "./-components/network-status-bar";
import { OfflineEmptyState } from "./-components/offline-empty-state";
import { StartNodeSheet } from "@/components/network/start-node-sheet";
import { StopNodeSheet } from "@/components/network/stop-node-sheet";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export const Route = createLazyFileRoute("/_app/devices/")({
  component: DevicesPage,
});

function DevicesPage() {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const navigate = useNavigate();

  const devices = useNetworkStore((s) => s.devices);
  const status = useNetworkStore((s) => s.status);
  const isOnline = status === "running" || status === "starting";
  const storedPairedDevices = useSecretStore((state) => state.pairedDevices);
  const directPairing = usePairingStore((state) => state.directPairing);

  // directPairing 成功后自动跳转到设备页面（刷新列表）
  usePairingSuccess();

  // 节点控制弹窗状态
  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const [stopSheetOpen, setStopSheetOpen] = useState(false);

  // 已配对设备：后端在线数据优先，离线回退到 secret-store
  const pairedDevices = useMemo<Device[]>(() => {
    const deviceMap = new Map(devices.map((d) => [d.peerId, d]));
    return storedPairedDevices.map((stored) => {
      const backendDevice = deviceMap.get(stored.peerId);
      if (backendDevice) {
        return backendDevice;
      }
      // 节点未运行或设备离线，用 secret-store 数据显示为离线
      return {
        peerId: stored.peerId,
        hostname: stored.hostname,
        os: stored.os,
        platform: stored.platform,
        arch: stored.arch,
        status: "offline" as const,
        isPaired: true,
      };
    });
  }, [storedPairedDevices, devices]);

  // 附近设备：后端返回的未配对设备
  const filteredNearbyDevices = useMemo(() => {
    return devices.filter((d) => !d.isPaired);
  }, [devices]);

  const handleSend = useCallback((device: Device) => {
    navigate({ to: "/send", search: { peerId: device.peerId } });
  }, [navigate]);

  const handleConnect = useCallback((device: Device) => {
    directPairing(device.peerId);
  }, [directPairing]);

  const handleUnpair = useCallback(async (device: Device) => {
    try {
      // 同时更新后端运行时状态（节点未运行时静默成功）
      await removePairedDevice(device.peerId);
      useSecretStore.getState().removePairedDevice(device.peerId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, []);

  const handleStatusClick = useCallback(() => {
    if (status === "running") setStopSheetOpen(true);
    else setStartSheetOpen(true);
  }, [status]);

  const viewProps: DevicesViewProps = {
    isOnline,
    pairedDevices,
    nearbyDevices: filteredNearbyDevices,
    onSend: handleSend,
    onConnect: handleConnect,
    onUnpair: handleUnpair,
    onStartClick: useCallback(() => setStartSheetOpen(true), []),
    onStopClick: useCallback(() => setStopSheetOpen(true), []),
    onStatusClick: handleStatusClick,
  };

  return (
    <>
      {isMobile ? (
        <MobileDevicesView {...viewProps} />
      ) : (
        <DesktopDevicesView {...viewProps} />
      )}

      {/* 节点控制弹窗 */}
      <StartNodeSheet open={startSheetOpen} onOpenChange={setStartSheetOpen} />
      <StopNodeSheet open={stopSheetOpen} onOpenChange={setStopSheetOpen} />
    </>
  );
}

/* ─────────────────── 共享类型与组件 ─────────────────── */

interface DevicesViewProps {
  isOnline: boolean;
  pairedDevices: Device[];
  nearbyDevices: Device[];
  onSend: (device: Device) => void;
  onConnect: (device: Device) => void;
  onUnpair: (device: Device) => void;
  onStartClick: () => void;
  onStopClick: () => void;
  onStatusClick: () => void;
}

/** 设备列表分区（已配对 / 附近） */
const DeviceSection = memo(function DeviceSection({
  title,
  devices,
  variant,
  containerClass,
  onSend,
  onConnect,
  onUnpair,
}: {
  title: React.ReactNode;
  devices: Device[];
  variant?: "card" | "list";
  containerClass: string;
  onSend: (device: Device) => void;
  onConnect: (device: Device) => void;
  onUnpair?: (device: Device) => void;
}) {
  if (devices.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 md:gap-4">
      <div className="flex items-center gap-1.5 md:gap-2">
        <h2 className="text-[15px] font-semibold text-foreground md:text-sm">
          {title}
        </h2>
        <span className="text-[13px] text-muted-foreground">
          ({devices.length})
        </span>
      </div>
      <div className={containerClass}>
        {devices.map((device) => (
          <DeviceCard
            key={device.peerId}
            device={device}
            variant={variant}
            onSend={onSend}
            onConnect={onConnect}
            onUnpair={onUnpair}
          />
        ))}
      </div>
    </section>
  );
});

/* ─────────────────── 移动端视图 ─────────────────── */

const MobileDevicesView = memo(function MobileDevicesView({
  isOnline,
  pairedDevices,
  nearbyDevices,
  onSend,
  onConnect,
  onUnpair,
  onStartClick,
  onStopClick,
  onStatusClick,
}: DevicesViewProps) {
  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      <div className="px-4 pt-3">
        <NetworkStatusBar onStopClick={onStopClick} onStatusClick={onStatusClick} />
      </div>

      {isOnline ? (
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="flex flex-col gap-5">
            <DeviceSection
              title={<Trans>已配对设备</Trans>}
              devices={pairedDevices}
              variant="list"
              containerClass="flex flex-col gap-2.5"
              onSend={onSend}
              onConnect={onConnect}
              onUnpair={onUnpair}
            />
            <DeviceSection
              title={<Trans>附近设备</Trans>}
              devices={nearbyDevices}
              variant="list"
              containerClass="flex flex-col gap-2.5"
              onSend={onSend}
              onConnect={onConnect}
            />
          </div>
        </div>
      ) : (
        <OfflineEmptyState onStartClick={onStartClick} />
      )}
    </main>
  );
});

/* ─────────────────── 桌面端视图 ─────────────────── */

const DesktopDevicesView = memo(function DesktopDevicesView({
  isOnline,
  pairedDevices,
  nearbyDevices,
  onSend,
  onConnect,
  onUnpair,
  onStartClick,
  onStopClick,
  onStatusClick,
}: DevicesViewProps) {
  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      <header className="flex h-13 items-center justify-between border-b border-border px-4 lg:px-5">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-medium text-foreground">
            <Trans>设备</Trans>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <AddDeviceMenu />
        </div>
      </header>

      {isOnline ? (
        <div className="flex-1 overflow-auto p-5 lg:p-6">
          <div className="flex flex-col gap-6">
            <NetworkStatusBar onStopClick={onStopClick} onStatusClick={onStatusClick} />

            <DeviceSection
              title={<Trans>已配对设备</Trans>}
              devices={pairedDevices}
              containerClass="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              onSend={onSend}
              onConnect={onConnect}
              onUnpair={onUnpair}
            />

            <div className="h-px bg-border" />

            <DeviceSection
              title={<Trans>附近设备</Trans>}
              devices={nearbyDevices}
              containerClass="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              onSend={onSend}
              onConnect={onConnect}
            />
          </div>
        </div>
      ) : (
        <OfflineEmptyState onStartClick={onStartClick} />
      )}
    </main>
  );
});
