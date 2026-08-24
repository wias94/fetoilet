import { createFileRoute, Navigate } from "@tanstack/react-router";
import { WorkShell } from "@/components/work-shell";
import { ChatThread } from "@/components/chat-thread";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/work/mail/$id")({ component: WorkMailChatPage });

function WorkMailChatPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <WorkShell>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-fg/10" />
      </WorkShell>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: `/work/mail/${id}` }} />;
  return (
    <WorkShell>
      <ChatThread id={id} backTo="/work/mail" backLabel="私信" />
    </WorkShell>
  );
}
