import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ChatThread } from "@/components/chat-thread";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/mail/$id")({ component: MailChatPage });

function MailChatPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <AppShell>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-fg/10" />
      </AppShell>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: `/mail/${id}` }} />;
  return (
    <AppShell>
      <ChatThread id={id} backTo="/mail" backLabel="私信" />
    </AppShell>
  );
}
