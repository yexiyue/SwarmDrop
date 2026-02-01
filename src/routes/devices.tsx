import { createFileRoute } from "@tanstack/react-router";
import { Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceCard, type Device } from "@/components/devices/device-card";
import { Trans } from "@lingui/react/macro";

export const Route = createFileRoute("/devices")({
  component: DevicesPage,
});

// Mock data matching the design
const pairedDevices: Device[] = [
  {
    id: "1",
    name: "张三的 iPhone",
    type: "smartphone",
    status: "online",
    connection: "lan",
    latency: 2,
    isPaired: true,
  },
  {
    id: "2",
    name: "王五的 MacBook",
    type: "laptop",
    status: "online",
    connection: "dcutr",
    latency: 45,
    isPaired: true,
  },
  {
    id: "3",
    name: "赵六的 Desktop",
    type: "desktop",
    status: "online",
    connection: "relay",
    latency: 180,
    isPaired: true,
  },
  {
    id: "4",
    name: "李四的 iPad",
    type: "tablet",
    status: "offline",
    isPaired: true,
  },
];

const nearbyDevices: Device[] = [
  {
    id: "5",
    name: "Windows PC",
    type: "desktop",
    status: "online",
    connection: "lan",
    latency: 3,
    isPaired: false,
  },
];

function DevicesPage() {
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
      <header className="flex h-13 items-center justify-between border-b border-border px-5">
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
      <div className="flex-1 overflow-auto p-8">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                ({nearbyDevices.length})
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {nearbyDevices.map((device) => (
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
