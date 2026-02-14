import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { useLingui } from "@lingui/react/macro";
import { mobileNavItems } from "@/components/layout/nav-items";

export function BottomNav() {
  const { t } = useLingui();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav className="flex h-14 shrink-0 items-center justify-around border-t border-border bg-background pb-(--sab)">
      {mobileNavItems.map((item) => {
        const isActive =
          currentPath === item.href ||
          (item.href !== "/" && currentPath.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            to={item.href}
            preload="intent"
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] transition-colors",
              isActive
                ? "text-blue-600"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            <span>{t(item.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
