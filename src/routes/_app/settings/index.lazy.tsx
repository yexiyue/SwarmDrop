/**
 * Settings Page (Lazy)
 * 设置页面 - 懒加载组件
 */

import { useState, useEffect } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { hostname } from "@tauri-apps/plugin-os";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useShallow } from "zustand/react/shallow";
import { usePreferencesStore } from "@/stores/preferences-store";
import { locales, type LocaleKey } from "@/lib/i18n";
import { AboutSection } from "./-about-section";

export const Route = createLazyFileRoute("/_app/settings/")({
  component: SettingsPage,
});

const themeOptions = [
  { value: "system", label: msg`跟随系统` },
  { value: "light", label: msg`浅色` },
  { value: "dark", label: msg`深色` },
];

function SettingsPage() {
  const { t } = useLingui();
  const { theme, setTheme } = useTheme();
  const { locale, deviceName, setLocale } = usePreferencesStore(
    useShallow((state) => ({
      locale: state.locale,
      deviceName: state.deviceName,
      setLocale: state.setLocale,
    }))
  );

  const [systemHostname, setSystemHostname] = useState("");

  useEffect(() => {
    hostname().then((name) => setSystemHostname(name ?? ""));
  }, []);

  const displayName = deviceName || systemHostname || "SwarmDrop";
  const avatarInitials = displayName.slice(0, 2).toUpperCase();

  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      {/* Toolbar */}
      <header className="flex h-13 items-center justify-between border-b border-border px-3 md:px-4 lg:px-5">
        <h1 className="text-[15px] font-medium text-foreground">
          <Trans>设置</Trans>
        </h1>
      </header>

      {/* Page Content */}
      <div className="flex-1 overflow-auto p-4 md:p-5 lg:p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {/* 关于 & 更新 */}
          <AboutSection />

          {/* 设备信息 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              <Trans>设备信息</Trans>
            </h2>
            <div className="flex items-center gap-4 rounded-lg border border-border p-4">
              <Avatar className="size-14">
                <AvatarFallback className="text-lg font-semibold">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <span className="text-base font-medium text-foreground">
                  {displayName}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {systemHostname}
                </span>
              </div>
            </div>
          </section>

          {/* 外观 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              <Trans>外观</Trans>
            </h2>
            <div className="rounded-lg border border-border">
              {/* 主题 */}
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    <Trans>主题</Trans>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <Trans>选择应用的外观主题</Trans>
                  </span>
                </div>
                <Select
                  value={theme}
                  onValueChange={setTheme}
                >
                  <SelectTrigger className="w-30 sm:w-35">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 语言 */}
              <div className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    <Trans>语言</Trans>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <Trans>选择应用显示语言</Trans>
                  </span>
                </div>
                <Select
                  value={locale}
                  onValueChange={(value) => setLocale(value as LocaleKey)}
                >
                  <SelectTrigger className="w-30 sm:w-35">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(locales).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
