import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/work/mail")({ component: WorkMailLayout });

function WorkMailLayout() {
  return <Outlet />;
}
