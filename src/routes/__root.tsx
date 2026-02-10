/**
 * Root Layout
 * 应用根布局
 */

import { createRootRoute, Outlet } from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <Outlet />
      {/* {import.meta.env.DEV && <TanStackRouterDevtools />} */}
    </>
  );
}
