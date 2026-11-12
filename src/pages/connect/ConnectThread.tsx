import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  Bookmark,
  CheckCircle2,
  CircleCheck,
  Clock,
  CornerDownRight,
  Flag,
  History,
  Lightbulb,
  Lock,
  MessageSquare,
  Pencil,
  Reply,
  Share2,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  connectApi,
  type AttachmentRef,
  type PollView,
  type PostView,
  type ReactionKind,
  type ThreadDetail,
} from "@/lib/connectApi";
import { cn } from "@/lib/utils";
import {
  ConnectShell,
  ConnectUnavailable,
  EmptyState,
  ResolvedBadge,
  RoleBadge,
  SideCard,
  StatusChips,
  ThreadListSkeleton,
  TypeBadge,
  connectPaths,
} from "@/components/connect/connectUi";
import { ConnectEditor } from "@/components/connect/ConnectEditor";
import { AttachmentList, PostBody } from "@/components/connect/PostBody";
import { timeAgo, useConnectAvailability } from "@/components/connect/useConnect";
import { useAuth } from "@/contexts/AuthContext";

const PRIORITY_STYLE: Record<string, string> = {
  normal: "border-sky-200 bg-sky-50/70 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100",
  important: "border-amber-300 bg-amber-50/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100",
  critical: "border-rose-300 bg-rose-50/80 text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100",
};

function AnnouncementBanner({ info, onAcknowledge }: { info: NonNullable<ThreadDetail["announcement"]>; onAcknowledge: () => void }) {
  return (
    <section aria-label="Announcement" className={cn("rounded-xl border p-4", PRIORITY_STYLE[info.priority] ?? PRIORITY_STYLE.normal)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {info.priority === "critical" ? "Critical announcement" : info.priority === "important" ? "Important announcement" : "Announcement"}
          {info.target_equipment ? ` · for users of ${info.target_equipment.name}` : ""}
        </p>
        <p className="text-xs">
          {info.is_expired ? "Expired" : info.expires_at ? `Until ${new Date(info.expires_at).toLocaleString()}` : "No expiry"}
        </p>
      </div>
      {info.requires_acknowledgement ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {info.acknowledged ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> You acknowledged this
            </span>
          ) : (
            <Button size="sm" onClick={onAcknowledge}>
              I have read this
            </Button>
          )}
          {info.audience_count != null ? (
            <span className="text-xs">
              {info.acknowledged_count ?? 0} of {info.audience_count} acknowledged
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 text-xs opacity-80">Announcements never change bookings or instrument availability.</p>
    </section>
  );
}

function ReportButton({ postId }: { postId: number }) {
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<Array<{ key: string; label: string }>>([]);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-muted-foreground"
        onClick={async () => {
          setOpen(true);
          if (!reasons.length) {
            const res = await connectApi.reportReasons(postId);
            setReasons(res.data?.reasons ?? []);
          }
        }}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden /> Report
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report this post</AlertDialogTitle>
            <AlertDialogDescription>Moderators review every report. Several reports hide a post until they do.</AlertDialogDescription>
          </AlertDialogHeader>
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Reason</legend>
            {reasons.map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-sm">
                <input type="radio" name={`report-${postId}`} checked={reason === r.key} onChange={() => setReason(r.key)} />
                {r.label}
              </label>
            ))}
          </fieldset>
          <textarea
            className="min-h-[4rem] w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Anything moderators should know (optional)"
            aria-label="Report details"
            value={details}
            maxLength={1000}
            onChange={(e) => setDetails(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reason}
              onClick={async () => {
                const res = await connectApi.report(postId, reason, details);
                if (res.error) toast.error(res.error);
                else toast.success("Thank you. A moderator will review it.");
              }}
            >
              Send report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ModerateMenu({ post, onDone }: { post: PostView; onDone: (visibility: string) => void }) {
  const [pending, setPending] = useState<"hide" | "remove" | null>(null);
  const [reason, setReason] = useState("");
  const act = async (action: "hide" | "remove" | "restore", why = "") => {
    const res = await connectApi.moderatePost(post.id, action, why);
    if (!res.data) toast.error(res.error || "Could not moderate this post.");
    else {
      onDone(res.data.visibility);
      toast.success(action === "restore" ? "Post restored." : "Post moderated. The author has been told why.");
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Moderate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {post.visibility === "visible" ? (
            <>
              <DropdownMenuItem onClick={() => setPending("hide")}>Hide (reversible)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPending("remove")}>Remove</DropdownMenuItem>
            </>
          ) : post.visibility !== "deleted" ? (
            <DropdownMenuItem onClick={() => void act("restore")}>Restore</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending === "remove" ? "Remove this post?" : "Hide this post?"}</AlertDialogTitle>
            <AlertDialogDescription>The reason is recorded in the moderation log and shown to the author.</AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            className="min-h-[4rem] w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Reason"
            aria-label="Moderation reason"
            value={reason}
            maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reason.trim()}
              onClick={() => {
                if (pending) void act(pending, reason);
                setReason("");
                setPending(null);
              }}
            >
              {pending === "remove" ? "Remove" : "Hide"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatHours(h: number): string {
  if (h < 1) return "under an hour";
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}

const REACTIONS: Array<{ kind: ReactionKind; label: string; icon: typeof ThumbsUp }> = [
  { kind: "helpful", label: "Helpful", icon: ThumbsUp },
  { kind: "insightful", label: "Insightful", icon: Lightbulb },
  { kind: "thanks", label: "Thanks", icon: Heart },
];

function Reactions({ post, canReact, onChange }: { post: PostView; canReact: boolean; onChange: (p: PostView) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REACTIONS.map(({ kind, label, icon: Icon }) => {
        const active = post.my_reactions.includes(kind);
        const count = post.reactions[kind] ?? 0;
        return (
          <button
            key={kind}
            type="button"
            disabled={!canReact}
            aria-pressed={active}
            aria-label={`${label}${count ? ` (${count})` : ""}`}
            title={canReact ? label : "You cannot react to your own post"}
            onClick={async () => {
              const res = await connectApi.react(post.id, kind);
              if (!res.data) {
                toast.error(res.error || "Could not save your reaction.");
                return;
              }
              const mine = res.data.active ? [...post.my_reactions, kind] : post.my_reactions.filter((k) => k !== kind);
              onChange({ ...post, reactions: res.data.counts, my_reactions: mine });
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent",
              active && "border-primary/40 bg-primary/10 text-primary dark:text-sky-200",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
            {count ? <span className="tabular-nums">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function PostCard({
  post,
  community,
  parent,
  currentUserId,
  onReply,
  onChanged,
  onDeleted,
  onAccept,
  isAsker = false,
  canModerate = false,
}: {
  post: PostView;
  community: string;
  parent?: PostView;
  currentUserId?: number;
  onReply?: (p: PostView) => void;
  onChanged: (p: PostView) => void;
  onDeleted: (p: PostView) => void;
  /** Shown to the thread's author and moderators on Question / Technical Issue threads. */
  onAccept?: (p: PostView) => void;
  /** The viewer started the thread (accepting marks it Resolved). */
  isAsker?: boolean;
  /** Moderator of this community: hide / remove / restore. */
  canModerate?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(post.body_html);
  const [attachments, setAttachments] = useState<AttachmentRef[]>(post.attachments);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [history, setHistory] = useState<Array<{ id: number; body_html: string; editor: string; created_at: string; by_moderator: boolean }> | null>(null);
  const hidden = post.visibility !== "visible";

  const save = async () => {
    setSaving(true);
    const res = await connectApi.editPost(post.id, body, attachments.map((a) => a.id));
    setSaving(false);
    if (!res.data) {
      toast.error(res.error || "Could not save your changes.");
      return;
    }
    onChanged(res.data);
    setEditing(false);
  };

  return (
    <article
      id={`post-${post.id}`}
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm",
        post.is_accepted && "border-emerald-400 ring-1 ring-emerald-300 dark:border-emerald-700 dark:ring-emerald-800",
        post.is_verified_response && !post.is_accepted && "border-primary/30",
        hidden && "opacity-70",
      )}
    >
      {post.is_accepted ? (
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Accepted solution
        </p>
      ) : null}
      {post.is_verified_response && !post.is_accepted ? (
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-sky-300">
          <BadgeCheck className="h-4 w-4" aria-hidden /> Verified response from facility staff
        </p>
      ) : null}
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold">{post.author.name}</span>
        <RoleBadge badge={post.author.badge} />
        <span className="text-xs text-muted-foreground" title={new Date(post.created_at).toLocaleString()}>
          {timeAgo(post.created_at)}
        </span>
        {post.edited_at ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={async () => {
              if (history) {
                setHistory(null);
                return;
              }
              const res = await connectApi.revisions(post.id);
              setHistory(res.data?.results ?? []);
            }}
            disabled={post.author.id !== currentUserId && !post.can_edit}
          >
            <History className="h-3 w-3" aria-hidden /> edited
          </button>
        ) : null}
        {hidden ? <span className="rounded bg-muted px-1.5 text-[11px] text-muted-foreground">Hidden by a moderator</span> : null}
      </header>
      {parent ? (
        <a href={`#post-${parent.id}`} className="mt-2 flex items-start gap-1.5 rounded-md border-l-2 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted">
          <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">
            Replying to <span className="font-medium text-foreground">{parent.author.name}</span>
          </span>
        </a>
      ) : null}
      <div className="mt-3">
        {editing ? (
          <div className="space-y-2">
            <ConnectEditor value={body} onChange={setBody} community={community} attachments={attachments} onAttachmentsChange={setAttachments} compact ariaLabel="Edit your post" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <PostBody html={post.body_html} />
            <AttachmentList items={post.attachments} />
          </>
        )}
      </div>
      {history ? (
        <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="font-medium">Earlier versions</p>
          {history.length ? (
            history.map((h) => (
              <details key={h.id}>
                <summary className="cursor-pointer text-muted-foreground">
                  {new Date(h.created_at).toLocaleString()} · {h.editor}
                  {h.by_moderator ? " (moderator)" : ""}
                </summary>
                <PostBody html={h.body_html} className="mt-2 text-xs" />
              </details>
            ))
          ) : (
            <p className="text-muted-foreground">No earlier versions.</p>
          )}
        </div>
      ) : null}
      {!editing ? (
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Reactions post={post} canReact={post.author.id !== currentUserId && !hidden} onChange={onChanged} />
          <div className="flex items-center gap-1">
            {onAccept && !post.is_opening && !post.is_accepted && !hidden ? (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" onClick={() => onAccept(post)}>
                <CircleCheck className="h-3.5 w-3.5" aria-hidden /> {isAsker ? "This solved it: mark Resolved" : "Accept as solution"}
              </Button>
            ) : null}
            {onReply ? (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => onReply(post)}>
                <Reply className="h-3.5 w-3.5" aria-hidden /> Reply
              </Button>
            ) : null}
            {currentUserId && post.author.id !== currentUserId && !hidden ? <ReportButton postId={post.id} /> : null}
            {canModerate ? (
              <ModerateMenu
                post={post}
                onDone={(visibility) => onChanged({ ...post, visibility })}
              />
            ) : null}
            {post.can_edit ? (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </Button>
            ) : null}
            {post.can_delete && !post.is_opening ? (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
              </Button>
            ) : null}
          </div>
        </footer>
      ) : null}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this reply?</AlertDialogTitle>
            <AlertDialogDescription>It will no longer be shown. Moderators keep a record of the deletion.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const res = await connectApi.deletePost(post.id);
                if (res.error) toast.error(res.error);
                else onDeleted(post);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function Poll({ threadId, poll, canVote, onChange }: { threadId: number; poll: PollView; canVote: boolean; onChange: (p: PollView) => void }) {
  return (
    <section className="rounded-xl border bg-card p-4" aria-label="Poll">
      <ul className="space-y-2">
        {poll.options.map((o) => {
          const pct = poll.total_votes ? Math.round((o.vote_count / poll.total_votes) * 100) : 0;
          const mine = poll.my_vote === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={!canVote || poll.is_closed}
                onClick={async () => {
                  const res = await connectApi.vote(threadId, o.id);
                  if (res.data) onChange(res.data);
                  else toast.error(res.error || "Could not record your vote.");
                }}
                className={cn(
                  "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-default",
                  mine && "border-primary",
                )}
                aria-pressed={mine}
              >
                <span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} aria-hidden />
                <span className="relative flex justify-between gap-2">
                  <span className={cn(mine && "font-semibold")}>{o.label}</span>
                  <span className="tabular-nums text-muted-foreground">{pct}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {poll.total_votes} {poll.total_votes === 1 ? "vote" : "votes"}
        {poll.is_closed ? " · Closed" : poll.closes_at ? ` · Closes ${new Date(poll.closes_at).toLocaleString()}` : ""}
        {poll.my_vote && !poll.is_closed ? " · Choose another option to change your vote" : ""}
      </p>
    </section>
  );
}

export default function ConnectThread() {
  const { id = "" } = useParams();
  const threadId = Number(id);
  const navigate = useNavigate();
  const { available, loading } = useConnectAvailability();
  const { user } = useAuth();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [missing, setMissing] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<AttachmentRef[]>([]);
  const [replyTo, setReplyTo] = useState<PostView | null>(null);
  const [posting, setPosting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const replyRef = useRef<HTMLDivElement>(null);
  const draftKey = `reply:${threadId}`;
  const draftTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([connectApi.thread(threadId), connectApi.posts(threadId)]);
    if (!t.data) {
      setMissing(true);
      return;
    }
    setThread(t.data);
    setPosts(p.data?.results ?? []);
    setNextPage(p.data?.next ? 2 : null);
  }, [threadId]);

  useEffect(() => {
    if (!available || !threadId) return;
    void load();
    void connectApi.draft(draftKey).then((res) => {
      if (res.data?.payload?.body) setReplyBody(res.data.payload.body);
    });
  }, [available, threadId, load, draftKey]);

  const onReplyChange = (html: string) => {
    setReplyBody(html);
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      if (html) void connectApi.saveDraft(draftKey, { body: html });
    }, 1500);
  };

  if (loading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;
  if (missing) {
    return (
      <ConnectShell>
        <EmptyState icon={<Lock className="h-5 w-5" />} title="This discussion is not available to you">
          It may be in a community you are not a member of, or it was removed.
          <div className="mt-3">
            <Link to={connectPaths.home} className="text-primary hover:underline">
              Back to IITR Connect
            </Link>
          </div>
        </EmptyState>
      </ConnectShell>
    );
  }
  if (!thread || !thread.opening_post) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;

  const opening = thread.opening_post;
  const byId = new Map(posts.map((p) => [p.id, p]));
  const accepted = thread.accepted_post_id ? byId.get(thread.accepted_post_id) : undefined;

  const submitReply = async () => {
    if (!replyBody) return;
    setPosting(true);
    const res = await connectApi.reply(threadId, replyBody, replyTo?.id ?? null, replyAttachments.map((a) => a.id));
    setPosting(false);
    if (!res.data) {
      toast.error(res.error || "Could not post your reply.");
      return;
    }
    setPosts((list) => [...list, res.data!]);
    setReplyBody("");
    setReplyAttachments([]);
    setReplyTo(null);
    setThread((t) => (t ? { ...t, reply_count: t.reply_count + 1, following: true } : t));
    void connectApi.deleteDraft(draftKey);
    toast.success("Reply posted.");
  };

  const toggleFollow = async () => {
    const res = await connectApi.follow(threadId, thread.following ? null : "watching");
    if (res.error) toast.error(res.error);
    else setThread({ ...thread, following: !thread.following });
  };
  const toggleBookmark = async () => {
    const res = await connectApi.bookmark(threadId);
    if (res.data) setThread({ ...thread, bookmarked: res.data.bookmarked });
  };

  const aside = (
    <>
      <SideCard title="About this discussion">
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Community</dt>
            <dd>
              <Link to={connectPaths.community(thread.community.slug)} className="hover:text-primary hover:underline">
                {thread.community.name}
              </Link>
            </dd>
          </div>
          {thread.category ? (
            <div>
              <dt className="text-xs text-muted-foreground">Category</dt>
              <dd>{thread.category.name}</dd>
            </div>
          ) : null}
          {thread.equipment ? (
            <div>
              <dt className="text-xs text-muted-foreground">Equipment</dt>
              <dd>
                <Link to={`/equipment/${thread.equipment.id}`} className="hover:text-primary hover:underline">
                  {thread.equipment.name || `Equipment ${thread.equipment.id}`}
                </Link>
              </dd>
            </div>
          ) : null}
          <div className="flex gap-6">
            <div>
              <dt className="text-xs text-muted-foreground">Replies</dt>
              <dd className="tabular-nums">{thread.reply_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Views</dt>
              <dd className="tabular-nums">{thread.view_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Helpful</dt>
              <dd className="tabular-nums">{thread.helpful_count}</dd>
            </div>
          </div>
        </dl>
      </SideCard>
      <SideCard title="Before you rely on an answer">
        <p className="text-xs text-muted-foreground">
          Community replies are not official instructions. Follow the equipment SOP and check with the Lab Operator or Officer-in-Charge, whose replies carry a verified badge.
        </p>
      </SideCard>
    </>
  );

  return (
    <ConnectShell aside={aside}>
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to={connectPaths.home} className="hover:underline">
          IITR Connect
        </Link>{" "}
        /{" "}
        <Link to={connectPaths.community(thread.community.slug)} className="hover:underline">
          {thread.community.name}
        </Link>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge type={thread.type} />
          <StatusChips thread={thread} />
        </div>
        <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{thread.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium text-foreground">{thread.author.name}</span>
            <RoleBadge badge={thread.author.badge} />
          </span>
          <span>Started {timeAgo(thread.created_at)}</span>
          <span>Active {timeAgo(thread.last_activity_at)}</span>
        </div>
        {thread.tags.length ? (
          <div className="flex flex-wrap gap-1">
            {thread.tags.map((t) => (
              <Link key={t.slug} to={`/connect/search?tag=${encodeURIComponent(t.slug)}`} className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                #{t.name}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleFollow} aria-pressed={thread.following}>
            <Bell className={cn("h-4 w-4", thread.following && "fill-current text-primary")} aria-hidden />
            {thread.following ? "Following" : "Follow"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleBookmark} aria-pressed={thread.bookmarked}>
            <Bookmark className={cn("h-4 w-4", thread.bookmarked && "fill-current text-primary")} aria-hidden />
            {thread.bookmarked ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
              toast.success("Link copied. Only people with access to this community can open it.");
            }}
          >
            <Share2 className="h-4 w-4" aria-hidden /> Copy link
          </Button>
          {thread.permissions.can_moderate ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ShieldCheck className="h-4 w-4" aria-hidden /> Staff tools
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  These labels never change the instrument&apos;s availability or bookings.
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(
                  [
                    ["is_pinned", "Pin to the top of the community", thread.is_pinned],
                    ["is_known_problem", "Known problem", thread.is_known_problem],
                    ["has_workaround", "Workaround available", thread.has_workaround],
                    ["is_outdated", "Outdated guidance", thread.is_outdated],
                    ["resolved", "Mark issue resolved", Boolean(thread.marked_resolved_at)],
                  ] as const
                ).map(([key, label, checked]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={checked}
                    onCheckedChange={async (value) => {
                      const res = await connectApi.staffTools(thread.id, { [key]: value === true });
                      if (!res.data) toast.error(res.error || "Could not update this discussion.");
                      else setThread(res.data);
                    }}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={thread.status === "locked"}
                  onCheckedChange={async (value) => {
                    const res = await connectApi.lockThread(thread.id, value === true);
                    if (!res.data) toast.error(res.error || "Could not change the lock.");
                    else setThread(res.data);
                  }}
                >
                  Lock replies
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {thread.permissions.can_curate ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                const res = await connectApi.promote({ thread_id: thread.id, post_id: thread.accepted_post_id });
                if (!res.data) toast.error(res.error || "Could not create the article.");
                else navigate(`/connect/knowledge/${res.data.id}`);
              }}
            >
              <BookOpen className="h-4 w-4" aria-hidden /> Promote to Knowledge Hub
            </Button>
          ) : null}
          {thread.permissions.can_delete ? (
            <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Delete
            </Button>
          ) : null}
        </div>
      </header>

      {thread.announcement ? (
        <AnnouncementBanner
          info={thread.announcement}
          onAcknowledge={async () => {
            const res = await connectApi.acknowledge(thread.id);
            if (!res.data) toast.error(res.error || "Could not record your acknowledgement.");
            else setThread(res.data);
          }}
        />
      ) : null}

      <PostCard
        post={opening}
        community={thread.community.slug}
        currentUserId={user?.id}
        onChanged={(p) => setThread({ ...thread, opening_post: p })}
        onDeleted={() => navigate(connectPaths.community(thread.community.slug))}
      />
      {thread.poll ? <Poll threadId={thread.id} poll={thread.poll} canVote={thread.permissions.can_reply} onChange={(poll) => setThread({ ...thread, poll })} /> : null}

      {thread.solution ? (
        <section aria-label="Accepted solution" className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-5 w-5" aria-hidden /> {thread.solution.resolved_by_author ? "Resolved" : "Solved"}
                {thread.solution.resolved_by_author ? <ResolvedBadge /> : null}
              </h2>
              {thread.solution.resolved_by_author ? (
                <p className="mt-0.5 text-xs font-medium text-emerald-900 dark:text-emerald-200">
                  Confirmed by the person who asked: this answer resolved their question.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-emerald-900/80 dark:text-emerald-200/80">
                  Accepted by a moderator. Waiting for the person who asked to confirm it resolved their question.
                </p>
              )}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-emerald-900/80 dark:text-emerald-200/80">
                <span className="inline-flex items-center gap-1">
                  Answer by <span className="font-medium">{thread.solution.solver.name}</span>
                  {thread.solution.solver.badge ? <RoleBadge badge={thread.solution.solver.badge} /> : null}
                </span>
                <span>· accepted by {thread.solution.accepted_by_author ? "the person who asked" : thread.solution.accepted_by}</span>
                <span className="inline-flex items-center gap-1">
                  · <Clock className="h-3 w-3" aria-hidden /> resolved in {formatHours(thread.solution.resolution_hours)}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
            {thread.solution.can_confirm_resolved ? (
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={async () => {
                  const res = await connectApi.confirmResolved(thread.id);
                  if (!res.data) toast.error(res.error || "Could not mark this as resolved.");
                  else {
                    setThread(res.data);
                    toast.success("Marked as resolved. Thank you for closing the loop.");
                  }
                }}
              >
                <BadgeCheck className="h-4 w-4" aria-hidden /> Mark as Resolved
              </Button>
            ) : null}
            {thread.permissions.can_accept ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={async () => {
                  const res = await connectApi.revokeSolution(thread.id);
                  if (!res.data) toast.error(res.error || "Could not change the accepted answer.");
                  else {
                    setThread(res.data);
                    setPosts((list) => list.map((p) => ({ ...p, is_accepted: false })));
                  }
                }}
              >
                Revoke
              </Button>
            ) : null}
            </div>
          </div>
          {accepted ? (
            <div className="rounded-lg border bg-card p-3">
              <PostBody html={accepted.body_html} />
              <a href={`#post-${accepted.id}`} className="mt-2 block text-xs text-muted-foreground hover:underline">
                See it in the discussion
              </a>
            </div>
          ) : null}
        </section>
      ) : thread.is_solvable && thread.permissions.can_accept && posts.length ? (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Did a reply solve this? Choose <span className="font-medium">Accept as solution</span> on it so others find the answer.
        </p>
      ) : null}

      {thread.articles.length ? (
        <section aria-label="Knowledge Hub" className="flex flex-wrap items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-muted-foreground">In the Knowledge Hub:</span>
          {thread.articles.map((ar) => (
            <Link key={ar.id} to={`/connect/knowledge/${ar.id}`} className="font-medium text-primary hover:underline">
              {ar.title}
              {ar.status !== "published" ? ` (${ar.status.replace("_", " ")})` : ""}
            </Link>
          ))}
        </section>
      ) : null}

      <section aria-label="Replies" className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="h-5 w-5 text-primary" aria-hidden /> {thread.reply_count} {thread.reply_count === 1 ? "reply" : "replies"}
        </h2>
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            community={thread.community.slug}
            currentUserId={user?.id}
            parent={p.parent_id && p.parent_id !== opening.id ? byId.get(p.parent_id) : undefined}
            onReply={thread.permissions.can_reply ? (target) => {
              setReplyTo(target);
              replyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            } : undefined}
            onAccept={thread.permissions.can_accept && thread.is_solvable ? async (target) => {
              const res = await connectApi.acceptSolution(thread.id, target.id);
              if (!res.data) {
                toast.error(res.error || "Could not accept this answer.");
                return;
              }
              setThread(res.data);
              setPosts((list) => list.map((x) => ({ ...x, is_accepted: x.id === target.id })));
              toast.success(res.data.is_resolved ? "Marked as resolved." : "Marked as the accepted solution.");
            } : undefined}
            isAsker={user?.id === thread.author.id}
            canModerate={thread.permissions.can_moderate}
            onChanged={(updated) => setPosts((list) => list.map((x) => (x.id === updated.id ? updated : x)))}
            onDeleted={(gone) => {
              setPosts((list) => list.filter((x) => x.id !== gone.id));
              setThread((t) => (t ? { ...t, reply_count: Math.max(0, t.reply_count - 1) } : t));
            }}
          />
        ))}
        {nextPage ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              const res = await connectApi.posts(threadId, nextPage);
              setPosts((list) => [...list, ...(res.data?.results ?? [])]);
              setNextPage(res.data?.next ? nextPage + 1 : null);
            }}
          >
            Show more replies
          </Button>
        ) : null}
      </section>

      <section ref={replyRef} aria-label="Write a reply" className="space-y-2">
        {thread.permissions.can_reply ? (
          <>
            <h2 className="text-base font-semibold">Your reply</h2>
            {replyTo ? (
              <p className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs">
                <span>
                  Replying to <span className="font-medium">{replyTo.author.name}</span>
                </span>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setReplyTo(null)}>
                  Cancel
                </button>
              </p>
            ) : null}
            <ConnectEditor
              value={replyBody}
              onChange={onReplyChange}
              community={thread.community.slug}
              attachments={replyAttachments}
              onAttachmentsChange={setReplyAttachments}
              compact
              ariaLabel="Your reply"
              placeholder="Share what worked, what you checked, or ask a follow-up question…"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Your draft is saved as you type. You will follow this discussion after replying.</p>
              <Button onClick={submitReply} disabled={posting || !replyBody}>
                {posting ? "Posting…" : "Post reply"}
              </Button>
            </div>
          </>
        ) : (
          <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {thread.status === "locked" ? "This discussion is locked." : "Replies are not available to you in this community."}
          </p>
        )}
      </section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this discussion?</AlertDialogTitle>
            <AlertDialogDescription>You can delete it only while nobody has replied. Moderators keep a record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const res = await connectApi.deleteThread(thread.id);
                if (res.error) toast.error(res.error);
                else navigate(connectPaths.community(thread.community.slug));
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConnectShell>
  );
}
