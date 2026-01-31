import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  // Redirect to devices page by default
  return <Navigate to="/devices" />;
}
