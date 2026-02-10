/**
 * AddDeviceMenu
 * "连接设备"下拉菜单：生成配对码 / 输入配对码
 */

import { Link, Keyboard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trans } from "@lingui/react/macro";
import { usePairingStore } from "@/stores/pairing-store";

export function AddDeviceMenu() {
  const generateCode = usePairingStore((s) => s.generateCode);
  const openInput = usePairingStore((s) => s.openInput);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="h-auto gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[13px] font-medium hover:bg-blue-700"
        >
          <Plus className="size-4" />
          <Trans>连接设备</Trans>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => void generateCode()}>
          <Link className="size-4" />
          <Trans>生成配对码</Trans>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openInput}>
          <Keyboard className="size-4" />
          <Trans>输入配对码</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
