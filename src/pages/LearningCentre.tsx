import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BookOpenCheck, CheckCircle2, ExternalLink, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingBlock, SectionCard, TrainingPageFrame } from "@/components/training/trainingUi";
import { learningApi, type EquipmentModules, type LearningModule, type QuizResult } from "@/lib/learningApi";
import { cn } from "@/lib/utils";

function StatusChip({ m }: { m: LearningModule }) {
  const p = m.progress;
  const [label, style] = p.complete
    ? ["Complete", "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"]
    : p.viewed_at
      ? ["In progress", "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"]
      : ["Not started", "border-border bg-muted text-muted-foreground"];
  return <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", style)}>{label}</span>;
}

// --------------------------------------------------------------------------- learner: one module
function Quiz({ module, onDone }: { module: LearningModule; onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const questions = module.questions ?? [];
  const toggle = (qid: number, idx: number, multiple: boolean) =>
    setAnswers((a) => {
      const cur = a[String(qid)] ?? [];
      const next = multiple ? (cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx]) : [idx];
      return { ...a, [String(qid)]: next };
    });
  const submit = async () => {
    setBusy(true);
    const res = await learningApi.attempt(module.id, answers);
    setBusy(false);
    if (res.error) return void toast.error(res.error);
    setResult(res.data ?? null);
    onDone();
  };
  const byId = new Map((result?.results ?? []).map((r) => [r.question_id, r]));
  return (
    <div className="space-y-3" data-testid="quiz">
      <p className="text-sm font-medium">
        Quiz · pass mark {module.pass_mark_pct}%
        {module.progress.best_score_pct !== null ? ` · your best ${module.progress.best_score_pct}%` : ""}
      </p>
      {questions.map((q, n) => {
        const r = byId.get(q.id);
        return (
          <fieldset key={q.id} className="space-y-1.5 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">
              {n + 1}. {q.text}
              {q.multiple ? <span className="ml-1 text-xs font-normal text-muted-foreground">(choose all that apply)</span> : null}
            </legend>
            {q.options.map((opt, i) => {
              const id = `q${q.id}-o${i}`;
              const chosen = (answers[String(q.id)] ?? []).includes(i);
              return (
                <label key={id} htmlFor={id} className="flex items-center gap-2 text-sm">
                  <input
                    id={id}
                    type={q.multiple ? "checkbox" : "radio"}
                    name={`q${q.id}`}
                    checked={chosen}
                    disabled={Boolean(result)}
                    onChange={() => toggle(q.id, i, q.multiple)}
                  />
                  <span className={cn(r && r.correct_options.includes(i) && "font-medium text-emerald-700 dark:text-emerald-300")}>{opt}</span>
                </label>
              );
            })}
            {r ? (
              <p className={cn("text-xs", r.correct ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
                {r.correct ? "Correct." : "Not quite."} {r.explanation}
              </p>
            ) : null}
          </fieldset>
        );
      })}
      {result ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-sm font-medium", result.passed ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")} data-testid="quiz-score">
            {result.score_pct}% · {result.passed ? "Passed" : `Not passed (needs ${result.pass_mark_pct}%)`}
          </p>
          {!result.passed ? (
            <Button type="button" size="sm" variant="outline" onClick={() => { setResult(null); setAnswers({}); }}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : (
        <Button type="button" onClick={() => void submit()} disabled={busy || !questions.length}>
          Submit answers
        </Button>
      )}
    </div>
  );
}

function ModuleReader({ moduleId, onChanged }: { moduleId: number; onChanged: () => void }) {
  const [m, setM] = useState<LearningModule | null>(null);
  const [agree, setAgree] = useState(false);

  const load = useCallback(async () => {
    const res = await learningApi.module(moduleId);
    if (res.error) return void toast.error(res.error);
    setM(res.data ?? null);
  }, [moduleId]);

  useEffect(() => {
    void load();
    void learningApi.viewed(moduleId).then(() => onChanged());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  if (!m) return <LoadingBlock />;
  return (
    <div className="space-y-4 p-4">
      {m.summary ? <p className="text-sm text-muted-foreground">{m.summary}</p> : null}
      {m.body ? <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</div> : null}
      <div className="flex flex-wrap gap-2">
        {m.video_url ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={m.video_url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Watch the video
            </a>
          </Button>
        ) : null}
        {m.document_url ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={m.document_url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              <FileText className="h-4 w-4" aria-hidden />
              Open the SOP (PDF)
            </a>
          </Button>
        ) : null}
      </div>
      {m.requires_acknowledgement ? (
        m.progress.acknowledged_at ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Signed off {new Date(m.progress.acknowledged_at).toLocaleDateString()}
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} aria-label="Confirm you have read the material" />
              <span>{m.acknowledgement_text}</span>
            </label>
            <Button
              type="button"
              size="sm"
              disabled={!agree}
              onClick={async () => {
                const res = await learningApi.acknowledge(m.id);
                if (res.error) return void toast.error(res.error);
                void load();
                onChanged();
              }}
            >
              Sign off
            </Button>
          </div>
        )
      ) : null}
      {m.pass_mark_pct > 0 ? (
        m.progress.passed_at ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Quiz passed (best {m.progress.best_score_pct}%)
          </p>
        ) : (
          <Quiz module={m} onDone={() => { void load(); onChanged(); }} />
        )
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------------- staff: editing
function QuestionEditor({ moduleId, onAdded }: { moduleId: number; onAdded: () => void }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [correct, setCorrect] = useState<number[]>([]);
  const add = async () => {
    const res = await learningApi.addQuestion(moduleId, { text, options: options.map((o) => o.trim()), correct });
    if (res.error) return void toast.error(res.error);
    setText("");
    setOptions(["", ""]);
    setCorrect([]);
    onAdded();
  };
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label htmlFor={`new-q-${moduleId}`}>New question</Label>
      <Input id={`new-q-${moduleId}`} value={text} onChange={(e) => setText(e.target.value)} />
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <Checkbox
            checked={correct.includes(i)}
            onCheckedChange={(v) => setCorrect((c) => (v === true ? [...c, i] : c.filter((x) => x !== i)))}
            aria-label={`Option ${i + 1} is correct`}
          />
          <Input
            value={o}
            aria-label={`Option ${i + 1}`}
            onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOptions((o) => [...o, ""])} disabled={options.length >= 6}>
          Add option
        </Button>
        <Button type="button" size="sm" onClick={() => void add()} disabled={!text.trim() || !correct.length || options.some((o) => !o.trim())}>
          Save question
        </Button>
      </div>
    </div>
  );
}

function ModuleEditor({ module, onSaved }: { module: LearningModule; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: module.title,
    summary: module.summary,
    body: module.body ?? "",
    video_url: module.video_url,
    pass_mark_pct: String(module.pass_mark_pct),
    is_required: module.is_required,
    requires_acknowledgement: module.requires_acknowledgement,
  });
  const [detail, setDetail] = useState<LearningModule | null>(null);
  const loadDetail = useCallback(async () => {
    const res = await learningApi.module(module.id);
    if (res.data) {
      setDetail(res.data);
      setForm((f) => ({ ...f, body: res.data?.body ?? "" }));
    }
  }, [module.id]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);
  const save = async (extra: { is_published?: boolean } = {}) => {
    const res = await learningApi.updateModule(module.id, { ...form, pass_mark_pct: Number(form.pass_mark_pct || 0), ...extra });
    if (res.error) return void toast.error(res.error);
    toast.success("Saved");
    onSaved();
  };
  return (
    <div className="space-y-3 p-4" data-testid="module-editor">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`m-title-${module.id}`}>Title</Label>
          <Input id={`m-title-${module.id}`} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`m-video-${module.id}`}>Video link (https)</Label>
          <Input id={`m-video-${module.id}`} value={form.video_url} onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`m-summary-${module.id}`}>Summary</Label>
        <Input id={`m-summary-${module.id}`} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`m-body-${module.id}`}>Reading material</Label>
        <Textarea id={`m-body-${module.id}`} rows={6} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={form.is_required} onCheckedChange={(v) => setForm((f) => ({ ...f, is_required: v }))} aria-label="Required" />
          Required
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={form.requires_acknowledgement} onCheckedChange={(v) => setForm((f) => ({ ...f, requires_acknowledgement: v }))} aria-label="Sign-off required" />
          Read-and-understood sign-off
        </label>
        <label className="flex items-center gap-2">
          Pass mark %
          <Input className="w-20" type="number" min={0} max={100} value={form.pass_mark_pct} onChange={(e) => setForm((f) => ({ ...f, pass_mark_pct: e.target.value }))} aria-label="Pass mark" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`m-doc-${module.id}`} className="text-sm">
          SOP PDF
        </Label>
        <Input
          id={`m-doc-${module.id}`}
          type="file"
          accept="application/pdf"
          className="max-w-xs"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const res = await learningApi.uploadDocument(module.id, file);
            if (res.error) toast.error(res.error);
            else {
              toast.success("Document attached");
              onSaved();
            }
          }}
        />
        {module.document_url ? <span className="text-xs text-muted-foreground">A document is attached.</span> : null}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Questions ({detail?.questions?.length ?? 0})</p>
        <ul className="space-y-1 text-sm">
          {(detail?.questions ?? []).map((q) => (
            <li key={q.id} className={cn(!q.is_active && "opacity-60")}>
              {q.text} <span className="text-xs text-muted-foreground">· correct: {(q.correct ?? []).map((i) => q.options[i]).join(", ")}</span>
            </li>
          ))}
        </ul>
        <QuestionEditor moduleId={module.id} onAdded={() => { void loadDetail(); onSaved(); }} />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => void save()}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={() => void save({ is_published: !module.is_published })}>
          {module.is_published ? "Unpublish" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- page
export default function LearningCentre() {
  const { equipmentId } = useParams();
  const id = Number(equipmentId);
  const [data, setData] = useState<EquipmentModules | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(async () => {
    const res = await learningApi.modules(id);
    if (res.error) return void setError(res.error);
    setError("");
    setData(res.data ?? null);
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  if (!id) return <EmptyState title="Choose an equipment" description="Open online learning from the equipment's page." />;

  return (
    <TrainingPageFrame
      title={data ? `Online learning: ${data.equipment.name}` : "Online learning"}
      description="Read the material, sign off the SOP and pass the quiz before hands-on training."
      icon={<BookOpenCheck className="h-6 w-6" />}
      onRefresh={() => void load()}
    >
      {error ? (
        <EmptyState title="Not available" description={error} />
      ) : !data ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          {data.required_incomplete.length ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100" data-testid="learning-pending">
              Still to complete: {data.required_incomplete.join("; ")}.
              {data.modules_before_training_request ? " You can request training once these are done." : ""}
            </p>
          ) : data.results.length ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">All required modules are complete.</p>
          ) : null}

          {data.can_edit ? (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing} onCheckedChange={setEditing} aria-label="Edit content" />
                Edit content
              </label>
              {data.can_configure ? (
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={data.modules_before_training_request}
                    aria-label="Require modules before a training request"
                    onCheckedChange={async (v) => {
                      const res = await learningApi.saveSetting(id, v);
                      if (res.error) toast.error(res.error);
                      else void load();
                    }}
                  />
                  Required modules must be complete before a training request
                </label>
              ) : null}
            </div>
          ) : null}

          {!data.results.length ? (
            <EmptyState title="No online learning yet" description={data.can_edit ? "Add the first module below." : "Ask the Lab staff about training on this equipment."} />
          ) : (
            data.results.map((m) => (
              <SectionCard
                key={m.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {m.title}
                    {!m.is_published ? <span className="text-xs font-normal text-muted-foreground">(draft)</span> : null}
                    {!m.is_required ? <span className="text-xs font-normal text-muted-foreground">(optional)</span> : null}
                  </span>
                }
                actions={
                  <div className="flex items-center gap-2">
                    <StatusChip m={m} />
                    <Button type="button" size="sm" variant="outline" onClick={() => setOpen(open === m.id ? null : m.id)}>
                      {open === m.id ? "Close" : editing ? "Edit" : "Open"}
                    </Button>
                  </div>
                }
              >
                {open === m.id ? (
                  editing && m.can_edit ? <ModuleEditor module={m} onSaved={() => void load()} /> : <ModuleReader moduleId={m.id} onChanged={() => void load()} />
                ) : m.summary ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">{m.summary}</p>
                ) : null}
              </SectionCard>
            ))
          )}

          {editing ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="new-module">New module title</Label>
                <Input id="new-module" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Radiation safety and SOP" />
              </div>
              <Button
                type="button"
                className="gap-1.5"
                disabled={!newTitle.trim()}
                onClick={async () => {
                  const res = await learningApi.createModule(id, { title: newTitle.trim() });
                  if (res.error) return void toast.error(res.error);
                  setNewTitle("");
                  setOpen(res.data?.id ?? null);
                  void load();
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add module
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </TrainingPageFrame>
  );
}
