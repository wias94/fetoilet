import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/mail")({ component: MailLayout });

function MailLayout() {
  return <Outlet />;
}
