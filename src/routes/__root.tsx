import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Sidebar } from "@/components/layout/sidebar";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <div className="flex h-screen bg-background font-sans antialiased">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  );
}
