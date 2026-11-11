import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectApi, type CommunitySummary } from "@/lib/connectApi";
import { ConnectShell, ConnectUnavailable, ThreadListSkeleton, connectPaths } from "@/components/connect/connectUi";
import { ThreadFeed } from "@/components/connect/ThreadFeed";
import { useConnectAvailability } from "@/components/connect/useConnect";

/** Search and every filtered list (Solved, Announcements, Bookmarks, My Discussions) across the caller's communities. */
export default function ConnectSearch() {
  const navigate = useNavigate();
  const { available, loading } = useConnectAvailability();
  const [communities, setCommunities] = useState<CommunitySummary[] | undefined>();

  useEffect(() => {
    if (!available) return;
    void connectApi.communities().then((res) => setCommunities(res.data?.results));
  }, [available]);

  if (loading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;

  return (
    <ConnectShell
      communities={communities}
      header={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Discussions</h1>
            <p className="text-sm text-muted-foreground">Search and browse every community you belong to.</p>
          </div>
          <Button onClick={() => navigate(connectPaths.newThread())} className="gap-2">
            <PenSquare className="h-4 w-4" aria-hidden /> Start a Discussion
          </Button>
        </div>
      }
    >
      <ThreadFeed />
    </ConnectShell>
  );
}
