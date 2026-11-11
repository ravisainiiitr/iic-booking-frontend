import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Info, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  THREAD_TYPES,
  connectApi,
  type AttachmentRef,
  type CommunityDetail,
  type CommunitySummary,
  type DraftPayload,
  type ThreadType,
} from "@/lib/connectApi";
import { cn } from "@/lib/utils";
import { ConnectShell, ConnectUnavailable, InlineError, SideCard, ThreadListSkeleton, connectPaths } from "@/components/connect/connectUi";
import { ConnectEditor } from "@/components/connect/ConnectEditor";
import { SimilarDiscussions } from "@/components/connect/SimilarDiscussions";
import { useConnectAvailability } from "@/components/connect/useConnect";

const TITLE_MIN = 8;
const MAX_TAGS = 5;

function draftKeyFor(equipmentId: number | null, communityId: number | null) {
  if (equipmentId) return `new:equipment:${equipmentId}`;
  if (communityId) return `new:community:${communityId}`;
  return "new";
}

export default function ConnectNewThread() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetCommunity = params.get("community");
  const presetEquipment = Number(params.get("equipment") || "") || null;
  const presetCategory = params.get("category");
  const { available, loading } = useConnectAvailability();

  const [communities, setCommunities] = useState<CommunitySummary[] | null>(null);
  const [communitySlug, setCommunitySlug] = useState<string>("");
  const [detail, setDetail] = useState<CommunityDetail | null>(null);
  const [type, setType] = useState<ThreadType>("question");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [equipmentId, setEquipmentId] = useState<number | null>(presetEquipment);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [follow, setFollow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const restored = useRef(false);
  const saveTimer = useRef<number | null>(null);

  const postable = useMemo(() => (communities ?? []).filter((c) => c.can_post), [communities]);
  const community = postable.find((c) => c.slug === communitySlug) ?? null;
  const draftKey = draftKeyFor(presetEquipment, community?.id ?? null);
  const isStaff = Boolean(detail?.can_moderate);

  // Communities, then the preset (from the equipment page or a community page).
  useEffect(() => {
    if (!available) return;
    void connectApi.communities().then((res) => {
      const list = res.data?.results ?? [];
      setCommunities(list);
      const preset = list.find((c) => c.slug === presetCommunity && c.can_post);
      if (preset) setCommunitySlug(preset.slug);
      else if (list.filter((c) => c.can_post).length === 1) setCommunitySlug(list.filter((c) => c.can_post)[0].slug);
    });
  }, [available, presetCommunity]);

  useEffect(() => {
    if (!communitySlug) {
      setDetail(null);
      return;
    }
    void connectApi.community(communitySlug).then((res) => {
      setDetail(res.data ?? null);
      const preset = presetCategory ? res.data?.categories.find((c) => c.slug === presetCategory) : undefined;
      if (preset) setCategoryId(preset.id);
    });
  }, [communitySlug, presetCategory]);

  // Keep the equipment choice valid for the chosen group (never send equipment from another group).
  useEffect(() => {
    if (!detail || equipmentId == null) return;
    if (detail.kind === "group" && !(detail.equipment ?? []).some((e) => e.equipment_id === equipmentId)) setEquipmentId(null);
  }, [detail, equipmentId]);

  // Restore a draft once.
  useEffect(() => {
    if (!available || restored.current || communities === null) return;
    restored.current = true;
    void connectApi.draft(draftKey).then((res) => {
      const p = res.data?.payload;
      if (!p) return;
      if (p.title) setTitle(p.title);
      if (p.body) setBody(p.body);
      if (p.type) setType(p.type);
      if (p.tags) setTags(p.tags);
      if (p.category_id) setCategoryId(p.category_id);
      if (p.poll_options?.length) setPollOptions(p.poll_options);
      toast.info("Your unsent draft was restored.");
    });
  }, [available, communities, draftKey]);

  // Autosave.
  useEffect(() => {
    if (!restored.current || (!title && !body)) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const payload: DraftPayload = {
        title, body, type, tags, category_id: categoryId, community_id: community?.id ?? null, equipment_id: equipmentId,
        poll_options: type === "poll" ? pollOptions : undefined,
      };
      const res = await connectApi.saveDraft(draftKey, payload);
      if (res.data) setSavedAt(res.data.updated_at);
    }, 1500);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [title, body, type, tags, categoryId, equipmentId, pollOptions, draftKey, community?.id]);

  const addTag = () => {
    const slug = tagDraft.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (slug.length >= 2 && !tags.includes(slug) && tags.length < MAX_TAGS) setTags([...tags, slug]);
    setTagDraft("");
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !tagDraft && tags.length) {
      setTags(tags.slice(0, -1));
    }
  };

  const submit = async () => {
    setError(null);
    if (!community) return setError({ message: "Choose where to post.", field: "community" });
    if (title.trim().length < TITLE_MIN) return setError({ message: `The title needs at least ${TITLE_MIN} characters.`, field: "title" });
    if (!body) return setError({ message: "Write something before posting.", field: "body" });
    setSubmitting(true);
    const res = await connectApi.createThread({
      community: community.slug,
      title: title.trim(),
      body,
      type,
      category_id: categoryId,
      equipment_id: equipmentId,
      tags,
      attachments: attachments.map((a) => a.id),
      poll_options: type === "poll" ? pollOptions.map((o) => o.trim()).filter(Boolean) : undefined,
      follow,
    });
    setSubmitting(false);
    if (!res.data) {
      setError({ message: res.error || "Could not start the discussion.", field: res.field });
      return;
    }
    void connectApi.deleteDraft(draftKey);
    toast.success("Your discussion is live.");
    navigate(connectPaths.thread(res.data.id), { replace: true });
  };

  if (loading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;
  if (communities === null) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;

  const types = THREAD_TYPES.filter((t) => !t.staffOnly || isStaff);
  const categories = (detail?.categories ?? []).filter((c) => !c.staff_only_posting || isStaff);
  const equipment = detail?.equipment ?? [];
  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  const aside = (
    <>
      <SideCard title="Find a solution first" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />}>
        <p className="text-muted-foreground">As you type a title, similar discussions from your communities appear below it. Check them before posting.</p>
      </SideCard>
      <SideCard title="Writing a good question" icon={<Info className="h-4 w-4 text-primary" aria-hidden />}>
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
          <li>Name the instrument, mode and sample.</li>
          <li>Say what you expected and what you saw.</li>
          <li>Attach a screenshot or the data file.</li>
          <li>Never share passwords or personal data.</li>
        </ul>
      </SideCard>
    </>
  );

  return (
    <ConnectShell
      communities={communities}
      aside={aside}
      header={
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Start a Discussion</h1>
          <p className="text-sm text-muted-foreground">Ask a question, report an issue or share what you learned.</p>
        </div>
      }
    >
      {!postable.length ? (
        <InlineError message="You cannot start discussions yet. Communities open to you will appear here once you book equipment." />
      ) : null}
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="connect-community">Community</Label>
            <Select value={communitySlug} onValueChange={(v) => { setCommunitySlug(v); setCategoryId(null); }}>
              <SelectTrigger id="connect-community" aria-invalid={Boolean(fieldError("community"))}>
                <SelectValue placeholder="Choose where to post" />
              </SelectTrigger>
              <SelectContent>
                {postable.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {community?.kind === "group" ? (
              <p className="text-xs text-muted-foreground">Visible only to this equipment group&apos;s members and staff.</p>
            ) : community ? (
              <p className="text-xs text-muted-foreground">Visible to all IIT Roorkee users of the portal.</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="connect-category">Category</Label>
            <Select value={categoryId ? String(categoryId) : "none"} onValueChange={(v) => setCategoryId(v === "none" ? null : Number(v))} disabled={!categories.length}>
              <SelectTrigger id="connect-category">
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Type</legend>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {types.map((t) => (
              <label
                key={t.value}
                className={cn(
                  "flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  type === t.value && "border-primary bg-primary/5",
                )}
              >
                <input type="radio" name="type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} className="sr-only" />
                <span className="font-medium">{t.label}</span>
                <span className="text-xs text-muted-foreground">{t.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {equipment.length || presetEquipment ? (
          <div className="space-y-1.5">
            <Label htmlFor="connect-equipment">Equipment</Label>
            <Select value={equipmentId ? String(equipmentId) : "none"} onValueChange={(v) => setEquipmentId(v === "none" ? null : Number(v))}>
              <SelectTrigger id="connect-equipment" aria-invalid={Boolean(fieldError("equipment"))}>
                <SelectValue placeholder="Not about one instrument" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not about one instrument</SelectItem>
                {equipment.map((e) => (
                  <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                    {e.name} ({e.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("equipment") ? <p className="text-xs text-destructive">{fieldError("equipment")}</p> : null}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="connect-title">Title</Label>
          <Input
            id="connect-title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Baseline drift on the XRD detector after warm-up"
            aria-invalid={Boolean(fieldError("title"))}
            aria-describedby="connect-title-help"
          />
          <p id="connect-title-help" className={cn("text-xs text-muted-foreground", fieldError("title") && "text-destructive")}>
            {fieldError("title") ?? "A specific title helps others find and answer it."}
          </p>
          <SimilarDiscussions title={title} community={community?.slug} equipmentId={equipmentId} />
        </div>

        <div className="space-y-1.5">
          <Label>Details</Label>
          <ConnectEditor
            value={body}
            onChange={setBody}
            community={community?.slug}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            invalid={Boolean(fieldError("body") || fieldError("attachments"))}
          />
          {fieldError("body") || fieldError("attachments") ? (
            <p className="text-xs text-destructive">{fieldError("body") || fieldError("attachments")}</p>
          ) : null}
        </div>

        {type === "poll" ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Poll options</legend>
            {pollOptions.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={o}
                  maxLength={200}
                  aria-label={`Option ${i + 1}`}
                  onChange={(e) => setPollOptions(pollOptions.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Option ${i + 1}`}
                />
                {pollOptions.length > 2 ? (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove option ${i + 1}`} onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            {pollOptions.length < 10 ? (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setPollOptions([...pollOptions, ""])}>
                <Plus className="h-4 w-4" aria-hidden /> Add option
              </Button>
            ) : null}
            {fieldError("poll_options") ? <p className="text-xs text-destructive">{fieldError("poll_options")}</p> : null}
          </fieldset>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="connect-tags">Tags</Label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                #{t}
                <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              id="connect-tags"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={addTag}
              disabled={tags.length >= MAX_TAGS}
              placeholder={tags.length >= MAX_TAGS ? "Up to 5 tags" : "Add a tag and press Enter"}
              className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm outline-none"
            />
          </div>
          {fieldError("tags") ? <p className="text-xs text-destructive">{fieldError("tags")}</p> : null}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={follow} onCheckedChange={(v) => setFollow(v === true)} className="mt-0.5" />
          <span>
            Notify me about replies
            <span className="block text-xs text-muted-foreground">You can change how often you get email in notification settings.</span>
          </span>
        </label>

        {error && !error.field ? <InlineError message={error.message} /> : null}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}` : "Your draft is saved automatically."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !postable.length}>
              {submitting ? "Posting…" : "Post discussion"}
            </Button>
          </div>
        </div>
      </form>
    </ConnectShell>
  );
}
