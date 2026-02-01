import { createRootRoute, Outlet } from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { AppSidebar } from "@/components/layout/sidebar";
import { NetworkProvider } from "@/contexts/network-context";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <NetworkProvider>
      <SidebarProvider
        className="h-svh"
        style={
          {
            "--sidebar-width": "220px",
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
      {/* {import.meta.env.DEV && <TanStackRouterDevtools />} */}
    </NetworkProvider>
  );
}
