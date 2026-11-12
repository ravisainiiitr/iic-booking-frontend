import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, Bell, Compass, Lock, PenSquare, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { connectApi, type CommunityDetail, type CommunitySummary } from "@/lib/connectApi";
import { ConnectShell, ConnectUnavailable, EmptyState, RoleBadge, SideCard, ThreadListSkeleton, connectPaths } from "@/components/connect/connectUi";
import { ThreadFeed } from "@/components/connect/ThreadFeed";
import { useConnectAvailability } from "@/components/connect/useConnect";

export default function ConnectCommunity() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { available, loading } = useConnectAvailability();
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [communities, setCommunities] = useState<CommunitySummary[] | undefined>();
  const [missing, setMissing] = useState(false);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    setCommunity(null);
    setMissing(false);
    void Promise.all([connectApi.community(slug), connectApi.communities()]).then(([c, list]) => {
      if (!alive) return;
      if (!c.data) setMissing(true);
      setCommunity(c.data ?? null);
      setFollowing(Boolean(c.data?.following));
      setCommunities(list.data?.results);
    });
    return () => {
      alive = false;
    };
  }, [available, slug]);

  if (loading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;
  if (missing) {
    return (
      <ConnectShell communities={communities}>
        <EmptyState icon={<Lock className="h-5 w-5" />} title="This community is not available to you">
          Equipment group communities are open to people who booked the group&apos;s equipment and to its facility staff.
          <div className="mt-3">
            <Link to={connectPaths.communities} className="text-primary hover:underline">
              See your communities
            </Link>
          </div>
        </EmptyState>
      </ConnectShell>
    );
  }
  if (!community) return <ConnectShell communities={communities}><ThreadListSkeleton /></ConnectShell>;

  const toggleFollow = async () => {
    const res = await connectApi.followCommunity(community.slug, following ? null : "watching");
    if (res.error) toast.error(res.error);
    else {
      setFollowing(!following);
      toast.success(following ? "You stopped following this community." : "You will be notified about new discussions here.");
    }
  };

  const header = (
    <header className="rounded-2xl bg-gradient-to-br from-brand via-[hsl(215_62%_22%)] to-slate-950 px-5 py-6 text-white shadow-lg shadow-primary/15 sm:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-white/70">
            {community.kind === "general" ? <Compass className="h-3.5 w-3.5" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
            {community.kind === "general" ? "General IITR Discussions" : "Equipment Group community · private"}
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{community.name}</h1>
          {community.description ? <p className="mt-1 max-w-2xl text-sm text-white/80">{community.description}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/75">
            <span>{community.thread_count ?? 0} discussions</span>
            {community.member_count != null ? (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden /> {community.member_count} members
              </span>
            ) : null}
            {community.status === "archived" ? (
              <span className="inline-flex items-center gap-1">
                <Archive className="h-3.5 w-3.5" aria-hidden /> Archived: read only
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={toggleFollow} className="gap-2 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Bell className={following ? "h-4 w-4 fill-current" : "h-4 w-4"} aria-hidden />
            {following ? "Following" : "Follow"}
          </Button>
          {community.can_post ? (
            <Button onClick={() => navigate(connectPaths.newThread({ community: community.slug }))} className="gap-2 bg-white text-primary hover:bg-white/90 hover:text-primary">
              <PenSquare className="h-4 w-4" aria-hidden /> Start a Discussion
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );

  const aside = (
    <>
      {community.my_badge ? (
        <SideCard title="Your role here">
          <RoleBadge badge={community.my_badge} />
        </SideCard>
      ) : null}
      {community.staff.length ? (
        <SideCard title="Facility staff" icon={<ShieldCheck className="h-4 w-4 text-primary" aria-hidden />}>
          <ul className="space-y-2">
            {community.staff.map((s) => (
              <li key={s.user_id} className="flex flex-col">
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.badge}</span>
              </li>
            ))}
          </ul>
        </SideCard>
      ) : null}
      {community.equipment?.length ? (
        <SideCard title="Equipment in this group">
          <ul className="space-y-1.5">
            {community.equipment.map((e) => (
              <li key={e.equipment_id}>
                <Link to={`/equipment/${e.equipment_id}`} className="text-sm hover:text-primary hover:underline">
                  {e.name}
                </Link>
                <span className="ml-1 text-xs text-muted-foreground">{e.code}</span>
              </li>
            ))}
          </ul>
        </SideCard>
      ) : null}
      <SideCard title="About this community" icon={<Lock className="h-4 w-4 text-muted-foreground" aria-hidden />}>
        <p className="text-muted-foreground">
          {community.kind === "general"
            ? "Open to IIT Roorkee students, faculty and staff signed in to the portal."
            : "Visible only to people who booked this group's equipment and to its Officers-in-Charge, Lab Operators and moderators."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Replies from community members are not official instructions. Look for verified staff badges and reviewed Knowledge Hub articles.
        </p>
      </SideCard>
    </>
  );

  return (
    <ConnectShell header={header} aside={aside} communities={communities}>
      <ThreadFeed community={community.slug} categories={community.categories} showCommunity={false} />
    </ConnectShell>
  );
}
