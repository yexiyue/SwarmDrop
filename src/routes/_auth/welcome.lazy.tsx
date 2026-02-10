/**
 * Welcome Page (Lazy)
 * 首次启动欢迎页面 - 懒加载组件
 */

import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Button } from "@/components/ui/button";
import { Send, Lock, Globe, Wifi, type LucideIcon } from "lucide-react";

export const Route = createLazyFileRoute("/_auth/welcome")({
  component: WelcomePage,
});

// Hoist features array outside component to avoid recreation
const FEATURES: Array<{
  icon: LucideIcon;
  title: MessageDescriptor;
  description: MessageDescriptor;
}> = [
  {
    icon: Lock,
    title: msg`端到端加密`,
    description: msg`文件传输全程加密保护`,
  },
  {
    icon: Globe,
    title: msg`跨网络传输`,
    description: msg`局域网和广域网无缝切换`,
  },
  {
    icon: Wifi,
    title: msg`无需服务器`,
    description: msg`点对点直连，无需注册账号`,
  },
];

function WelcomePage() {
  const { t } = useLingui();
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-sm rounded-xl bg-card p-8 shadow-sm">
      {/* Logo */}
      <div className="flex flex-col items-center space-y-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
          <Send className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-bold">SwarmDrop</h1>
        <p className="text-sm text-muted-foreground">
          <Trans>安全、快速的跨网络文件传输</Trans>
        </p>
      </div>

      {/* Features */}
      <div className="mt-8 space-y-4">
        {FEATURES.map((feature, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <feature.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium">{t(feature.title)}</h3>
              <p className="text-xs text-muted-foreground">
                {t(feature.description)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <Button
        size="lg"
        className="mt-8 w-full"
        onClick={() => navigate({ to: "/setup-password" })}
      >
        <Trans>开始使用</Trans>
      </Button>
    </div>
  );
}
