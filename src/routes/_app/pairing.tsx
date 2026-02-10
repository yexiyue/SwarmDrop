/**
 * Pairing Layout Route
 * 配对路由组布局（纯透传）
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/pairing")({
  component: () => <Outlet />,
});
