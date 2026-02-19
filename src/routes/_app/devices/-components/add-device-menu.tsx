/**
 * AddDeviceMenu
 * "连接设备"下拉菜单：生成配对码 / 输入配对码
 */

import { Link, Keyboard, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trans } from "@lingui/react/macro";

export function AddDeviceMenu() {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-auto gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium">
          <Plus className="size-4" />
          <Trans>连接设备</Trans>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => navigate({ to: "/pairing/generate" })}>
          <Link className="size-4" />
          <Trans>生成配对码</Trans>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/pairing/input" })}>
          <Keyboard className="size-4" />
          <Trans>输入配对码</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
