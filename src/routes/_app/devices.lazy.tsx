/**
 * Devices Page (Lazy)
 * 设备页面 - 懒加载组件
 */

import { useMemo } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceCard, type Device } from "@/components/devices/device-card";
import { Trans } from "@lingui/react/macro";
import {
  useNetworkStore,
  inferConnectionType,
  inferDeviceType,
  peerToDevice,
} from "@/stores/network-store";
import { useSecretStore } from "@/stores/secret-store";

export const Route = createLazyFileRoute("/_app/devices")({
  component: DevicesPage,
});

function DevicesPage() {
  // 从 network store 获取 peers 状态
  const peers = useNetworkStore((state) => state.peers);

  // 从 secret store 获取已配对设备
  const storedPairedDevices = useSecretStore((state) => state.pairedDevices);

  // 从 peers 派生附近设备列表
  const nearbyDevices = useMemo(() => {
    return Array.from(peers.values())
      .filter((peer) => peer.isConnected)
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
        type: inferDeviceType(stored.os),
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
    console.log("Send to device:", device);
  };

  const handleConnect = (device: Device) => {
    console.log("Connect to device:", device);
  };

  const handleAddDevice = () => {
    console.log("Add device");
  };

  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      {/* Toolbar */}
      <header className="flex h-13 items-center justify-between border-b border-border px-3 md:px-4 lg:px-5">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-medium text-foreground">
            <Trans>设备</Trans>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleAddDevice}
            className="h-auto gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[13px] font-medium hover:bg-blue-700"
          >
            <LinkIcon className="size-4" />
            <Trans>连接设备</Trans>
          </Button>
        </div>
      </header>

      {/* Page Content */}
      <div className="flex-1 overflow-auto p-4 md:p-5 lg:p-6">
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
                  onSend={handleSend}
                  onConnect={handleConnect}
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
                ({filteredNearbyDevices.length})
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredNearbyDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onSend={handleSend}
                  onConnect={handleConnect}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
