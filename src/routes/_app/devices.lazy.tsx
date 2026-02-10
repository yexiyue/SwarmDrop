/**
 * Devices Page (Lazy)
 * 设备页面 - 懒加载组件
 * 根据断点渲染移动端/桌面端不同布局
 */

import { useMemo, useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { DeviceCard, type Device } from "@/components/devices/device-card";
import { Trans } from "@lingui/react/macro";
import {
  useNetworkStore,
  inferConnectionType,
  inferDeviceType,
  peerToDevice,
} from "@/stores/network-store";
import { useSecretStore } from "@/stores/secret-store";
import { usePairingStore } from "@/stores/pairing-store";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { AddDeviceMenu } from "@/components/pairing/add-device-menu";
import { NetworkStatusBar } from "@/components/network/network-status-bar";
import { OfflineEmptyState } from "@/components/network/offline-empty-state";
import { StartNodeSheet } from "@/components/network/start-node-sheet";
import { StopNodeSheet } from "@/components/network/stop-node-sheet";

export const Route = createLazyFileRoute("/_app/devices")({
  component: DevicesPage,
});

function DevicesPage() {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // 共享数据 hooks
  const peers = useNetworkStore((state) => state.peers);
  const status = useNetworkStore((state) => state.status);
  const storedPairedDevices = useSecretStore((state) => state.pairedDevices);
  const directPairing = usePairingStore((s) => s.directPairing);

  // 节点控制弹窗状态
  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const [stopSheetOpen, setStopSheetOpen] = useState(false);

  // 从 peers 派生附近设备列表（过滤掉非 SwarmDrop 设备，如 bootstrap 节点）
  const nearbyDevices = useMemo(() => {
    return Array.from(peers.values())
      .filter((peer) => peer.isConnected && peer.agentInfo)
      .map(peerToDevice);
  }, [peers]);

  // 将已配对设备与在线状态结合
  const pairedDevices = useMemo<Device[]>(() => {
    return storedPairedDevices.map((stored) => {
      const peerInfo = peers.get(stored.id);
      const isOnline = peerInfo?.isConnected ?? false;
      const connection = isOnline ? inferConnectionType(peerInfo?.rttMs) : undefined;

      return {
        id: stored.id,
        name: stored.name,
        type: inferDeviceType(stored.platform ?? stored.os),
        status: isOnline ? "online" : "offline",
        connection,
        latency: isOnline ? peerInfo?.rttMs : undefined,
        isPaired: true,
      };
    });
  }, [storedPairedDevices, peers]);

  // 过滤掉已配对的设备，只显示未配对的附近设备
  const filteredNearbyDevices = useMemo(() => {
    const pairedIds = new Set(storedPairedDevices.map((d) => d.id));
    return nearbyDevices.filter((d) => !pairedIds.has(d.id));
  }, [nearbyDevices, storedPairedDevices]);

  const handleSend = (device: Device) => {
    // TODO: Phase 3 文件传输
    console.log("Send to device:", device);
  };

  const handleConnect = (device: Device) => {
    void directPairing(device.id);
  };

  const handleUnpair = (device: Device) => {
    useSecretStore.getState().removePairedDevice(device.id);
  };

  const isOnline = status === "running" || status === "starting";

  return (
    <>
      {isMobile ? (
        <MobileDevicesView
          isOnline={isOnline}
          pairedDevices={pairedDevices}
          nearbyDevices={filteredNearbyDevices}
          onSend={handleSend}
          onConnect={handleConnect}
          onUnpair={handleUnpair}
          onStartClick={() => setStartSheetOpen(true)}
          onStopClick={() => setStopSheetOpen(true)}
        />
      ) : (
        <DesktopDevicesView
          pairedDevices={pairedDevices}
          nearbyDevices={filteredNearbyDevices}
          onSend={handleSend}
          onConnect={handleConnect}
          onUnpair={handleUnpair}
        />
      )}

      {/* 节点控制弹窗 */}
      <StartNodeSheet open={startSheetOpen} onOpenChange={setStartSheetOpen} />
      <StopNodeSheet open={stopSheetOpen} onOpenChange={setStopSheetOpen} />

    </>
  );
}

/* ─────────────────── 移动端视图 ─────────────────── */

function MobileDevicesView({
  isOnline,
  pairedDevices,
  nearbyDevices,
  onSend,
  onConnect,
  onUnpair,
  onStartClick,
  onStopClick,
}: {
  isOnline: boolean;
  pairedDevices: Device[];
  nearbyDevices: Device[];
  onSend: (device: Device) => void;
  onConnect: (device: Device) => void;
  onUnpair: (device: Device) => void;
  onStartClick: () => void;
  onStopClick: () => void;
}) {
  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      {/* 网络状态条 */}
      <div className="px-4 pt-3">
        <NetworkStatusBar onStopClick={onStopClick} />
      </div>

      {/* 内容区域 */}
      {isOnline ? (
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="flex flex-col gap-5">
            {/* 已配对设备 */}
            {pairedDevices.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[15px] font-semibold text-foreground">
                    <Trans>已配对设备</Trans>
                  </h2>
                  <span className="text-[13px] text-muted-foreground">
                    ({pairedDevices.length})
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {pairedDevices.map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      variant="list"
                      onSend={onSend}
                      onConnect={onConnect}
                      onUnpair={onUnpair}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 附近设备 */}
            {nearbyDevices.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[15px] font-semibold text-foreground">
                    <Trans>附近设备</Trans>
                  </h2>
                  <span className="text-[13px] text-muted-foreground">
                    ({nearbyDevices.length})
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {nearbyDevices.map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      variant="list"
                      onSend={onSend}
                      onConnect={onConnect}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      ) : (
        <OfflineEmptyState onStartClick={onStartClick} />
      )}
    </main>
  );
}

/* ─────────────────── 桌面端视图 ─────────────────── */

function DesktopDevicesView({
  pairedDevices,
  nearbyDevices,
  onSend,
  onConnect,
  onUnpair,
}: {
  pairedDevices: Device[];
  nearbyDevices: Device[];
  onSend: (device: Device) => void;
  onConnect: (device: Device) => void;
  onUnpair: (device: Device) => void;
}) {
  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      {/* Toolbar */}
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

      {/* Page Content */}
      <div className="flex-1 overflow-auto p-5 lg:p-6">
        <div className="flex flex-col gap-6">
          {/* Paired Devices Section */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                <Trans>已配对设备</Trans>
              </h2>
              <span className="text-[13px] text-muted-foreground">
                ({pairedDevices.length})
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pairedDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onSend={onSend}
                  onConnect={onConnect}
                  onUnpair={onUnpair}
                />
              ))}
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Nearby Devices Section */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                <Trans>附近设备</Trans>
              </h2>
              <span className="text-[13px] text-muted-foreground">
                ({nearbyDevices.length})
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {nearbyDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onSend={onSend}
                  onConnect={onConnect}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
