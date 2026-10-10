import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, FlaskConical, Loader2, Paperclip, Send, Users, X } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import {
  EMPTY_FILTERS,
  FacilityGroupsApiError,
  facilityGroupsApi,
  formatBytes,
  newIdempotencyKey,
  parseAddresses,
  type AudienceFilters,
  type CcMode,
  type EmailDraft,
  type FacilityGroup,
  type GroupsOptions,
  type RecipientPreview,
} from "@/lib/facilityGroupsApi";
import { AudienceFiltersBar } from "./AudienceFiltersBar";
import { MultiSelect } from "./MultiSelect";
import { plural } from "./format";

export interface ComposeSeed {
  groupIds: number[];
  filters: AudienceFilters;
  nonce: number;
}

export function ComposeEmail({
  seed,
  options,
  onSent,
}: {
  seed: ComposeSeed | null;
  options: GroupsOptions | null;
  onSent: (campaignId: number) => void;
}) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<FacilityGroup[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<AudienceFilters>({ ...EMPTY_FILTERS });
  const [preview, setPreview] = useState<RecipientPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [showRecipients, setShowRecipients] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ccText, setCcText] = useState("");
  const [bccText, setBccText] = useState("");
  const [ccMode, setCcMode] = useState<CcMode>("summary");
  const [replyTo, setReplyTo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [renderHtml, setRenderHtml] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"" | "test" | "send" | "render">("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const fileInput = useRef<HTMLInputElement>(null);
  const limits = options?.limits;

  useEffect(() => {
    facilityGroupsApi
      .list()
      .then((res) => setGroups(res.results))
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!seed) return;
    setGroupIds(seed.groupIds.map(String));
    setFilters({ ...seed.filters, search: "" });
  }, [seed]);

  useEffect(() => {
    if (!groupIds.length) {
      setPreview(null);
      setPreviewError("");
      return;
    }
    let alive = true;
    setPreviewing(true);
    const t = setTimeout(() => {
      facilityGroupsApi
        .preview(groupIds.map(Number), filters)
        .then((res) => {
          if (!alive) return;
          setPreview(res);
          setPreviewError("");
        })
        .catch((err: Error) => {
          if (!alive) return;
          setPreview(null);
          setPreviewError(err.message || "Could not count the recipients.");
        })
        .finally(() => alive && setPreviewing(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [groupIds, filters]);

  const cc = useMemo(() => parseAddresses(ccText), [ccText]);
  const bcc = useMemo(() => parseAddresses(bccText), [bccText]);
  const reply = useMemo(() => parseAddresses(replyTo), [replyTo]);
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  const hasCopies = cc.valid.length + bcc.valid.length > 0;
  const eachTooMany = ccMode === "each" && hasCopies && (preview?.total ?? 0) > (limits?.each_mode_max_recipients ?? 200);
  const attachmentProblem =
    limits && files.length > limits.max_attachments
      ? `Attach at most ${limits.max_attachments} files.`
      : limits && files.some((f) => f.size > limits.max_attachment_mb * 1024 * 1024)
        ? `Each file must be under ${limits.max_attachment_mb} MB.`
        : limits && totalBytes > limits.max_total_attachment_mb * 1024 * 1024
          ? `Attachments must add up to under ${limits.max_total_attachment_mb} MB.`
          : "";
  const bodyEmpty = !body.replace(/<[^>]*>/g, "").trim();
  const draftProblem =
    !subject.trim()
      ? "Enter a subject."
      : bodyEmpty
        ? "Write the message."
        : cc.invalid.length
          ? `Check the CC address ${cc.invalid[0]}.`
          : bcc.invalid.length
            ? `Check the BCC address ${bcc.invalid[0]}.`
            : reply.invalid.length || reply.valid.length > 1
              ? "Reply-to takes one valid address."
              : attachmentProblem;
  const sendProblem =
    draftProblem ||
    (!groupIds.length
      ? "Choose at least one group."
      : !preview
        ? "Waiting for the recipient count."
        : preview.total === 0
          ? "No recipients match."
          : preview.total > preview.max_recipients
            ? `More than ${preview.max_recipients.toLocaleString()} recipients; narrow the filters.`
            : eachTooMany
              ? `CC / BCC on every email is limited to ${limits?.each_mode_max_recipients} recipients; use the summary copy.`
              : "");

  const draft = (): EmailDraft => ({
    subject: subject.trim(),
    body_html: body,
    cc: cc.valid,
    bcc: bcc.valid,
    cc_mode: ccMode,
    reply_to: reply.valid[0] ?? "",
  });

  const renderPreview = async () => {
    setBusy("render");
    try {
      const res = await facilityGroupsApi.render({ subject: subject.trim() || "(no subject)", body_html: body });
      setRenderHtml(res.html);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const sendTest = async () => {
    setBusy("test");
    try {
      const res = await facilityGroupsApi.sendTest(draft(), files);
      toast.success(`Test email sent to ${res.sent_to}.`);
    } catch (err) {
      toast.error((err as Error).message || "Could not send the test email.");
    } finally {
      setBusy("");
    }
  };

  const send = async () => {
    if (!preview) return;
    setBusy("send");
    try {
      const res = await facilityGroupsApi.send(
        {
          ...draft(),
          group_ids: groupIds.map(Number),
          filters,
          idempotency_key: idempotencyKey,
          expected_recipients: preview.total,
        },
        files,
      );
      toast.success(`Queued: ${plural(res.campaign.total_recipients, "recipient")}. Emails go out in batches.`);
      setConfirming(false);
      setIdempotencyKey(newIdempotencyKey());
      setSubject("");
      setBody("");
      setFiles([]);
      onSent(res.campaign.id);
    } catch (err) {
      if (err instanceof FacilityGroupsApiError && err.status === 409) {
        toast.warning(err.message);
        setConfirming(false);
        setFilters((f) => ({ ...f }));
      } else {
        toast.error((err as Error).message || "Could not send.");
      }
    } finally {
      setBusy("");
    }
  };

  const groupOptions = groups
    .filter((g) => !g.is_archived || groupIds.includes(String(g.id)))
    .map((g) => ({ value: String(g.id), label: g.name, group: g.kind_label, hint: g.member_count != null ? String(g.member_count) : undefined }));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-5">
        <section className="space-y-2">
          <Label>Groups</Label>
          <MultiSelect
            options={groupOptions}
            value={groupIds}
            onChange={setGroupIds}
            placeholder="Choose groups"
            searchPlaceholder="Search groups"
            className="w-full max-w-xl"
          />
          {groupIds.length ? (
            <div className="flex flex-wrap gap-1.5">
              {groupIds.map((id) => {
                const g = groups.find((x) => String(x.id) === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {g?.name ?? `Group ${id}`}
                    <X className="h-3 w-3 cursor-pointer" aria-label="Remove group" onClick={() => setGroupIds((v) => v.filter((x) => x !== id))} />
                  </Badge>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <Label>Narrow the recipients (optional)</Label>
          <AudienceFiltersBar value={filters} onChange={setFilters} options={options} showSearch={false} idPrefix="fg-compose" />
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="fg-subject">Subject</Label>
            <Input id="fg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Dear {{ name }}, …"
              ariaLabel="Email message"
              minHeightClass="min-h-[14rem]"
              maxLength={20000}
            />
            <p className="text-xs text-muted-foreground">
              Each person gets their own email inside the portal's branded template. Write <code>{"{{ name }}"}</code>,{" "}
              <code>{"{{ department }}"}</code> or <code>{"{{ email }}"}</code> to fill in each recipient's details.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fg-cc">CC</Label>
              <Input id="fg-cc" value={ccText} onChange={(e) => setCcText(e.target.value)} placeholder="hod@iitr.ac.in, …" />
              {cc.invalid.length ? <p className="text-xs text-destructive">Not valid: {cc.invalid.join(", ")}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fg-bcc">BCC</Label>
              <Input id="fg-bcc" value={bccText} onChange={(e) => setBccText(e.target.value)} placeholder="records@iitr.ac.in, …" />
              {bcc.invalid.length ? <p className="text-xs text-destructive">Not valid: {bcc.invalid.join(", ")}</p> : null}
            </div>
          </div>
          {hasCopies ? (
            <RadioGroup value={ccMode} onValueChange={(v) => setCcMode(v as CcMode)} className="gap-2">
              <div className="flex items-start gap-2">
                <RadioGroupItem value="summary" id="fg-cc-summary" className="mt-0.5" />
                <Label htmlFor="fg-cc-summary" className="font-normal">
                  <span className="font-medium">One copy to CC / BCC</span> (recommended): they get a single copy of the message noting the
                  groups and how many people it went to.
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="each" id="fg-cc-each" className="mt-0.5" />
                <Label htmlFor="fg-cc-each" className="font-normal">
                  <span className="font-medium">CC / BCC on every email</span>: each recipient sees the CC addresses and CC / BCC receive one
                  copy per recipient (up to {limits?.each_mode_max_recipients ?? 200} recipients).
                </Label>
              </div>
            </RadioGroup>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fg-reply">Reply-to (optional)</Label>
              <Input id="fg-reply" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="iic@iitr.ac.in" />
            </div>
            <div className="space-y-1.5">
              <Label>Attachments (optional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    setFiles((prev) => [...prev, ...picked]);
                    e.target.value = "";
                  }}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                  <Paperclip className="mr-1.5 h-4 w-4" />
                  Attach files
                </Button>
                <span className="text-xs text-muted-foreground">
                  Up to {limits?.max_attachments ?? 5} files, {limits?.max_attachment_mb ?? 5} MB each
                </span>
              </div>
              {files.length ? (
                <ul className="space-y-1 text-sm">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                      <X
                        className="h-3.5 w-3.5 cursor-pointer text-muted-foreground"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              {attachmentProblem ? <p className="text-xs text-destructive">{attachmentProblem}</p> : null}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void renderPreview()} disabled={busy !== "" || bodyEmpty}>
            {busy === "render" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Eye className="mr-1.5 h-4 w-4" />}
            Preview email
          </Button>
          <Button type="button" variant="outline" onClick={() => void sendTest()} disabled={busy !== "" || Boolean(draftProblem)}>
            {busy === "test" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-1.5 h-4 w-4" />}
            Send test to me{user?.email ? ` (${user.email})` : ""}
          </Button>
          <Button type="button" onClick={() => setConfirming(true)} disabled={busy !== "" || Boolean(sendProblem)}>
            <Send className="mr-1.5 h-4 w-4" />
            Send{preview?.total ? ` to ${plural(preview.total, "person", "people")}` : ""}
          </Button>
          {sendProblem ? <span className="text-sm text-muted-foreground">{sendProblem}</span> : null}
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Recipients</h3>
            {previewing ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>
          {!groupIds.length ? (
            <p className="mt-2 text-sm text-muted-foreground">Choose one or more groups to see who will receive the email.</p>
          ) : previewError ? (
            <p className="mt-2 text-sm text-destructive">{previewError}</p>
          ) : preview ? (
            <div className="mt-2 space-y-3 text-sm">
              <p className="text-3xl font-semibold tabular-nums" data-testid="fg-recipient-count">
                {preview.total.toLocaleString()}
              </p>
              <p className="text-muted-foreground">
                {preview.internal.toLocaleString()} internal · {preview.external.toLocaleString()} external
                {preview.without_email ? ` · ${preview.without_email} without an email address (skipped)` : ""}
              </p>
              {hasCopies ? (
                <p className="text-muted-foreground">
                  {ccMode === "summary"
                    ? `Plus one copy to ${plural(cc.valid.length + bcc.valid.length, "CC / BCC address", "CC / BCC addresses")}.`
                    : `CC / BCC added to each of the ${preview.total.toLocaleString()} emails.`}
                </p>
              ) : null}
              {preview.departments.length ? (
                <div>
                  <p className="mb-1 font-medium">By department / organisation</p>
                  <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs">
                    {preview.departments.map((d) => (
                      <li key={`${d.department_id}-${d.department_name}`} className="flex justify-between gap-2">
                        <span className="truncate">{d.department_name}</span>
                        <span className="tabular-nums text-muted-foreground">{d.total}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => setShowRecipients(true)} disabled={!preview.total}>
                View recipient list
              </Button>
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Every recipient gets a separate email, so no one sees anyone else's address. Emails go out in batches through the portal's
          mail service; progress and failures are listed under Sent emails.
        </p>
      </aside>

      <Dialog open={showRecipients} onOpenChange={setShowRecipients}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Recipients</DialogTitle>
            <DialogDescription>
              {preview && preview.recipients.length < preview.total
                ? `First ${preview.recipients.length} of ${preview.total.toLocaleString()}.`
                : `${preview?.total ?? 0} recipients.`}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department / Organisation</TableHead>
                <TableHead>User type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(preview?.recipients ?? []).map((r) => (
                <TableRow key={r.email}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-sm">{r.email}</TableCell>
                  <TableCell className="text-sm">{r.department_name || "—"}</TableCell>
                  <TableCell className="text-xs">{r.user_type_label || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={renderHtml !== null} onOpenChange={(v) => (!v ? setRenderHtml(null) : undefined)}>
        <DialogContent className="max-h-[90dvh] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription>As a recipient will see it (with sample name and department).</DialogDescription>
          </DialogHeader>
          {renderHtml ? (
            <iframe title="Email preview" sandbox="" srcDoc={renderHtml} className="h-[65dvh] w-full rounded-md border bg-white" />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={(v) => (!v && busy !== "send" ? setConfirming(false) : undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send this email?</DialogTitle>
            <DialogDescription>Sending cannot be undone. Emails still waiting can be cancelled from Sent emails.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Subject</dt>
            <dd className="font-medium">{subject}</dd>
            <dt className="text-muted-foreground">Groups</dt>
            <dd>{groupIds.map((id) => groups.find((g) => String(g.id) === id)?.name ?? id).join(", ")}</dd>
            <dt className="text-muted-foreground">Recipients</dt>
            <dd>{plural(preview?.total ?? 0, "person", "people")}, one email each</dd>
            {cc.valid.length ? (
              <>
                <dt className="text-muted-foreground">CC</dt>
                <dd>{cc.valid.join(", ")}</dd>
              </>
            ) : null}
            {bcc.valid.length ? (
              <>
                <dt className="text-muted-foreground">BCC</dt>
                <dd>{bcc.valid.join(", ")}</dd>
              </>
            ) : null}
            {hasCopies ? (
              <>
                <dt className="text-muted-foreground">CC / BCC get</dt>
                <dd>{ccMode === "summary" ? "One summary copy" : "A copy of every email"}</dd>
              </>
            ) : null}
            {files.length ? (
              <>
                <dt className="text-muted-foreground">Attachments</dt>
                <dd>{files.map((f) => f.name).join(", ")}</dd>
              </>
            ) : null}
          </dl>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={busy === "send"}>
              Back
            </Button>
            <Button type="button" onClick={() => void send()} disabled={busy === "send"}>
              {busy === "send" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
