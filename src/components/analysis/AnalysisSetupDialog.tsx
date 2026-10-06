import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { Check, Copy, Folder, FolderInput, FolderOutput, HardDrive, Loader2, MonitorSmartphone, Upload, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  PC_FOLDERS_CAPABILITY,
  type AnalysisInputSource,
  type AnalysisInputSourceKind,
  type AnalysisSetup,
  type AnalysisSetupRequest,
} from "@/lib/analysisSetupTypes";
import { formatBytes, plural } from "@/lib/analysisSync";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ResearchWorkspacePicker } from "@/components/my-research/ResearchWorkspacePicker";
import { UploadQueuePanel } from "@/components/my-research/UploadQueuePanel";
import { useResearchUploads } from "@/components/my-research/useResearchUploads";
import { cn } from "@/lib/utils";
import { InputBookingPicker } from "./InputBookingPicker";
import { inputSourceSummary, loadInputSources } from "@/lib/analysisInputSources";
import { useDirectAnalysisUploads } from "./useDirectAnalysisUploads";

/** What the page knows when the backend has no setup endpoint yet (results stay in Booking Details). */
export type LegacySetupContext = {
  virtualId: string;
  equipmentName: string;
  date?: string | null;
  status?: string | null;
  fileCount?: number | null;
  outputPath?: string | null;
  inputPath?: string | null;
};

export type PreparedSetup = {
  setup: AnalysisSetup | null;
  source: AnalysisInputSourceKind;
  inputLabel: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: number;
  /** null => backend without the setup API: same dialog without the project step. */
  setup: AnalysisSetup | null;
  legacy: LegacySetupContext;
  /** Starts the analysis once inputs are saved; resolve false to keep the dialog open. */
  onPrepared: (result: PreparedSetup) => Promise<boolean | void>;
  title?: string;
};

type Step = "idle" | "saving" | "uploading" | "finalizing" | "opening";

const LEGACY_DESTINATION = "Booking Details › Analyzed Data";

function setupErrorMessage(res: { error?: string; errorCode?: string }): string {
  switch (res.errorCode) {
    case "invalid_workspace":
      return "That project is no longer available. Choose another project.";
    case "input_booking_not_owned":
      return "You can only analyze data from your own bookings.";
    default:
      return res.error || "Couldn't save your analysis setup. Please try again.";
  }
}

function CopyPath({ path, testId, label }: { path: string; testId: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code
        className="min-w-0 flex-1 truncate rounded-md border bg-background px-2.5 py-1.5 font-mono text-xs"
        title={path}
        data-testid={testId}
      >
        {path}
      </code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 shrink-0 gap-1.5 bg-background"
        aria-label={`Copy ${label} path`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(path);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            /* clipboard blocked; the path stays selectable */
          }
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function SectionTitle({ n, children, id }: { n: number; children: string; id?: string }) {
  return (
    <h3 id={id} className="flex items-center gap-2 text-sm font-semibold">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0b3d91] text-[11px] font-bold text-white dark:bg-sky-500 dark:text-slate-950">
        {n}
      </span>
      {children}
    </h3>
  );
}

export function AnalysisSetupDialog({ open, onOpenChange, bookingId, setup, legacy, onPrepared, title = "Set up your analysis" }: Props) {
  const setupMode = Boolean(setup);
  const eligible = Boolean(setup?.my_research.eligible);
  const link = setup?.my_research.current_link ?? null;
  const workspaces = useMemo(() => setup?.my_research.workspaces ?? [], [setup]);
  const virtualId = setup?.booking.virtual_id || legacy.virtualId;
  const equipmentName = setup?.booking.equipment_name || legacy.equipmentName;

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [changingProject, setChangingProject] = useState(false);
  const [source, setSource] = useState<AnalysisInputSourceKind>("booking");
  const [inputBooking, setInputBooking] = useState<AnalysisInputSource | null>(null);
  const [defaultLoading, setDefaultLoading] = useState(false);
  const [pickingBooking, setPickingBooking] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef<AnalysisSetup | null>(null);
  const finalizingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputHeadingId = useId();
  const projectHeadingId = useId();

  const useResearch = setupMode && eligible;
  const previousUploadCount =
    setup?.input.selected?.source === "upload" ? Math.max(0, Number(setup.input.selected.file_count || 0)) : 0;
  const research = useResearchUploads(useResearch ? uploadTarget : null);
  const direct = useDirectAnalysisUploads(bookingId);
  const uploads = useResearch ? research : direct;

  const currentFallback = useCallback((): AnalysisInputSource => {
    const selected = setup?.input.selected;
    return {
      booking_id: setup?.booking.id ?? bookingId,
      virtual_id: virtualId,
      equipment_name: equipmentName,
      date: setup?.booking.date ?? legacy.date ?? null,
      status: setup?.booking.status ?? legacy.status ?? null,
      file_count:
        selected?.source === "booking" && selected.booking_id === (setup?.booking.id ?? bookingId)
          ? selected.file_count
          : setupMode
            ? null
            : legacy.fileCount ?? null,
      is_current: true,
      locked_reason: null,
    };
  }, [setup, setupMode, bookingId, virtualId, equipmentName, legacy.date, legacy.status, legacy.fileCount]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStep("idle");
    setPendingFiles([]);
    setPickingBooking(false);
    setUploadTarget(null);
    savedRef.current = null;
    finalizingRef.current = false;
    const linked = workspaces.find((w) => w.booking_linked);
    setWorkspaceId(link?.workspace_id ?? linked?.id ?? (workspaces.length === 1 ? workspaces[0].id : null));
    setChangingProject(false);
    setSource(setup?.input.selected?.source ?? setup?.input.default_source ?? "booking");

    const wanted = setup?.input.selected?.booking_id ?? setup?.input.default_booking_id ?? setup?.booking.id ?? bookingId;
    const fallback = currentFallback();
    setInputBooking(fallback);
    if (!setupMode) return;
    let alive = true;
    setDefaultLoading(true);
    loadInputSources(bookingId)
      .then(({ rows }) => {
        if (!alive) return;
        const match = rows.find((r) => r.booking_id === wanted) ?? rows.find((r) => r.is_current) ?? rows[0];
        if (match) setInputBooking(match);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setDefaultLoading(false);
      });
    return () => {
      alive = false;
    };
    // Reset only when the dialog opens or the server state it was opened with changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, setup]);

  const finish = useCallback(
    async (latest: AnalysisSetup | null) => {
      setStep("opening");
      const inputLabel =
        source === "upload"
          ? "Your uploaded files"
          : inputBooking
            ? `${inputBooking.virtual_id}${inputBooking.file_count != null ? ` · ${plural(inputBooking.file_count, "file")}` : ""}`
            : virtualId;
      const ok = await onPrepared({ setup: latest, source, inputLabel });
      if (ok === false) setStep("idle");
    },
    [onPrepared, source, inputBooking, virtualId],
  );

  const requestBody = useCallback(
    (inputSource: AnalysisInputSourceKind): AnalysisSetupRequest => ({
      workspace_id: eligible ? workspaceId : null,
      new_workspace_name: null,
      input_source: inputSource,
      input_booking_id: inputSource === "booking" ? inputBooking?.booking_id ?? bookingId : setup?.booking.id ?? bookingId,
    }),
    [eligible, workspaceId, inputBooking, bookingId, setup],
  );

  const finalizeUploads = useCallback(async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setStep("finalizing");
    let latest = savedRef.current;
    if (setupMode) {
      const res = await apiClient.saveBookingAnalysisSetup(bookingId, requestBody("upload"));
      if (res.error || !res.data) {
        setError(setupErrorMessage(res));
        setStep("idle");
        finalizingRef.current = false;
        return;
      }
      latest = res.data;
    }
    await finish(latest);
    finalizingRef.current = false;
  }, [setupMode, bookingId, requestBody, finish]);

  useEffect(() => {
    if (step !== "uploading" || uploads.busy || uploads.items.length === 0) return;
    const failed = uploads.items.filter((i) => i.status === "failed").length;
    const done = uploads.items.filter((i) => i.status === "done").length;
    if (failed > 0) {
      setError(`${plural(failed, "file")} didn't upload. Retry below, or continue with the files that did.`);
      return;
    }
    if (done === 0) {
      setError("No files were uploaded.");
      setStep("idle");
      return;
    }
    setError(null);
    void finalizeUploads();
  }, [step, uploads.busy, uploads.items, finalizeUploads]);

  const prepare = async () => {
    setError(null);
    if (step === "uploading") {
      if (uploads.items.some((i) => i.status === "done")) await finalizeUploads();
      return;
    }
    if (setupMode) {
      setStep("saving");
      const res = await apiClient.saveBookingAnalysisSetup(bookingId, requestBody(source));
      if (res.error || !res.data) {
        setError(setupErrorMessage(res));
        setStep("idle");
        return;
      }
      savedRef.current = res.data;
      if (source === "upload" && pendingFiles.length === 0 && previousUploadCount > 0) {
        await finish(res.data);
        return;
      }
      if (source === "upload") {
        if (useResearch) {
          const savedLink = res.data.my_research.current_link;
          if (!savedLink?.raw_folder_id) {
            setError("The Raw Data folder isn't ready yet. Please try again in a moment.");
            setStep("idle");
            return;
          }
          setUploadTarget(savedLink.workspace_id);
          research.clearFinished();
          research.addFiles(pendingFiles, { folderId: savedLink.raw_folder_id, bookingId });
        } else {
          direct.clearFinished();
          direct.addFiles(pendingFiles);
        }
        setPendingFiles([]);
        setStep("uploading");
        return;
      }
      await finish(res.data);
      return;
    }

    if (source === "upload") {
      direct.clearFinished();
      direct.addFiles(pendingFiles);
      setPendingFiles([]);
      setStep("uploading");
      return;
    }
    if (inputBooking && !inputBooking.is_current) {
      setStep("saving");
      const res = await apiClient.selectBookingAnalysisData(bookingId, { source_booking_id: inputBooking.booking_id, stage: true });
      if (res.error) {
        setError(res.error);
        setStep("idle");
        return;
      }
    }
    await finish(null);
  };

  const addPicked = (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) => f.size >= 0);
    if (!list.length) return;
    setPendingFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...list.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
    setSource("upload");
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addPicked(e.dataTransfer?.files ?? null);
  };

  const working = step !== "idle";
  const projectReady = !useResearch || Boolean(workspaceId);
  const bookingReady =
    source !== "booking" ||
    Boolean(inputBooking && !inputBooking.locked_reason && (inputBooking.file_count == null || inputBooking.file_count > 0));
  const uploadReady = source !== "upload" || pendingFiles.length > 0 || previousUploadCount > 0;
  const canPrepare =
    step === "uploading"
      ? !uploads.busy && uploads.items.some((i) => i.status === "done")
      : !working && projectReady && bookingReady && uploadReady;
  const blockedHint = working
    ? null
    : !projectReady
      ? "Choose a My Research project."
      : !bookingReady
        ? inputBooking?.locked_reason || "This booking has no files yet. Choose another booking or upload files."
        : !uploadReady
          ? "Add at least one file."
          : null;

  const selectedProjectName = workspaces.find((w) => w.id === workspaceId)?.name ?? link?.workspace_name ?? null;
  const folders = setup?.folders_preview ?? { root: virtualId, raw: "Raw Data", processed: "Processed Data" };
  const usingLinkedProject = Boolean(link && workspaceId === link.workspace_id);
  const destination = !setup
    ? LEGACY_DESTINATION
    : !useResearch || (usingLinkedProject && setup.output.destination_label)
      ? setup.output.destination_label || LEGACY_DESTINATION
      : `My Research › ${selectedProjectName ?? "your project"} / ${folders.root} / ${folders.processed}`;
  const pcOutputPath = setup ? setup.output.pc_output_path : legacy.outputPath || null;
  const pcInputPath = setup?.input.pc_input_path || legacy.inputPath || null;
  const pickerSupported = Boolean(setup?.agent?.capabilities?.includes(PC_FOLDERS_CAPABILITY));
  const autoDelete = setup ? setup.output.auto_delete_after_verify : false;
  const n = (base: number) => (useResearch ? base : base - 1);

  const close = (next: boolean) => {
    if (!next && (uploads.busy || step === "saving" || step === "finalizing" || step === "opening")) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-2xl" data-testid="analysis-setup-dialog">
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MonitorSmartphone className="h-5 w-5 text-[#0b3d91] dark:text-sky-300" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription>
            {equipmentName} · Booking <span className="font-mono font-medium text-foreground">{virtualId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {useResearch ? (
            <section aria-labelledby={projectHeadingId} className="space-y-2.5">
              <SectionTitle n={1} id={projectHeadingId}>
                Save to My Research project
              </SectionTitle>
              {link && !changingProject ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span>
                    Saving to{" "}
                    <strong>
                      {link.workspace_name} / {folders.root}
                    </strong>
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="ml-auto h-auto p-0"
                    disabled={working}
                    onClick={() => setChangingProject(true)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <ResearchWorkspacePicker
                  value={workspaceId}
                  onChange={setWorkspaceId}
                  options={workspaces}
                  canCreate={setup?.my_research.can_create}
                  required
                  label="Project"
                  helperText="This booking is added to the project. Its data and your results are kept in a folder named after the booking."
                />
              )}
              {useResearch && workspaces.length === 0 && !setup?.my_research.can_create ? (
                <p className="text-sm text-destructive">You don't have a My Research project yet. Create one in My Research first.</p>
              ) : null}
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" data-testid="folder-preview">
                <Folder className="h-3.5 w-3.5" aria-hidden />
                <span className="font-mono text-foreground">{folders.root}</span>
                <span aria-hidden>/</span>
                <span className="text-foreground">{folders.raw}</span>
                <span aria-hidden>·</span>
                <span className="text-foreground">{folders.processed}</span>
              </p>
            </section>
          ) : null}

          <section aria-labelledby={inputHeadingId} className="space-y-2.5">
            <SectionTitle n={n(2)} id={inputHeadingId}>
              Input data
            </SectionTitle>
            <RadioGroup
              value={source}
              onValueChange={(v) => setSource(v as AnalysisInputSourceKind)}
              className="gap-2"
              aria-labelledby={inputHeadingId}
              disabled={working}
            >
              <div
                className={cn(
                  "rounded-lg border p-3 transition",
                  source === "booking" ? "border-primary/60 bg-primary/5" : "hover:bg-muted/30",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <RadioGroupItem value="booking" id="ra-src-booking" className="mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label htmlFor="ra-src-booking" className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                      <HardDrive className="h-4 w-4 text-primary" aria-hidden /> Booking data
                    </label>
                    {source === "booking" ? (
                      <>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {inputBooking ? (
                            <p className="min-w-0 text-sm" data-testid="selected-input-booking">
                              <span className="font-mono font-semibold">{inputBooking.virtual_id}</span>
                              <span className="text-muted-foreground"> · {inputSourceSummary(inputBooking)}</span>
                              {defaultLoading ? (
                                <Loader2 className="ml-1.5 inline h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Loading" />
                              ) : null}
                            </p>
                          ) : null}
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            aria-expanded={pickingBooking}
                            disabled={working}
                            onClick={() => setPickingBooking((v) => !v)}
                          >
                            {pickingBooking ? "Done" : "Change booking"}
                          </Button>
                        </div>
                        {pickingBooking ? (
                          <InputBookingPicker
                            bookingId={bookingId}
                            selectedId={inputBooking?.booking_id ?? null}
                            preferLegacy={!setupMode}
                            disabled={working}
                            onSelect={(row) => setInputBooking(row)}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-lg border p-3 transition",
                  source === "upload" ? "border-primary/60 bg-primary/5" : "hover:bg-muted/30",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <RadioGroupItem value="upload" id="ra-src-upload" className="mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <label htmlFor="ra-src-upload" className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                      <Upload className="h-4 w-4 text-primary" aria-hidden /> Upload from my computer
                    </label>
                    {source === "upload" ? (
                      <>
                        {previousUploadCount > 0 && pendingFiles.length === 0 && (step === "idle" || step === "saving") ? (
                          <p className="text-sm text-muted-foreground" data-testid="previous-upload">
                            {plural(previousUploadCount, "file")} you uploaded earlier will be used
                            {useResearch ? ` (${folders.root} / ${folders.raw})` : ""}. Add more below if you need to.
                          </p>
                        ) : null}
                        {step === "idle" || step === "saving" ? (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOver(true);
                            }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={onDrop}
                            data-testid="upload-dropzone"
                            className={cn(
                              "flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition",
                              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                            )}
                          >
                            <p className="text-muted-foreground">Drag and drop files here, or</p>
                            <Button type="button" size="sm" variant="secondary" disabled={working} onClick={() => fileInputRef.current?.click()}>
                              Browse files
                            </Button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              className="hidden"
                              aria-label="Choose files to upload"
                              data-testid="upload-input"
                              onChange={(e) => {
                                addPicked(e.target.files);
                                e.target.value = "";
                              }}
                            />
                            <p className="text-xs text-muted-foreground">
                              {useResearch ? `Files are saved to ${folders.root} / ${folders.raw}.` : "Files are added to this booking's analysis input."}
                            </p>
                          </div>
                        ) : null}
                        {pendingFiles.length ? (
                          <ul className="divide-y rounded-lg border bg-background text-sm" aria-label="Files to upload">
                            {pendingFiles.map((f) => (
                              <li key={`${f.name}:${f.size}`} className="flex items-center gap-2 px-3 py-1.5">
                                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  aria-label={`Remove ${f.name}`}
                                  disabled={working}
                                  onClick={() => setPendingFiles((prev) => prev.filter((p) => p !== f))}
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <UploadQueuePanel items={uploads.items} onCancel={uploads.cancel} onRetry={uploads.retry} onClear={uploads.clearFinished} />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </RadioGroup>
          </section>

          <section className="space-y-2.5" aria-label="Your data on the Analysis PC">
            <SectionTitle n={n(3)}>Your data on the Analysis PC</SectionTitle>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3.5 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <FolderInput className="h-4 w-4 text-primary" aria-hidden />
                Your input data will be in:
              </p>
              {pcInputPath ? (
                <CopyPath path={pcInputPath} testId="pc-input-path" label="input folder" />
              ) : (
                <p className="rounded-md border bg-background px-2.5 py-1.5 text-xs">
                  The <strong>Input</strong> folder. Its full path is shown once the Analysis PC is ready.
                </p>
              )}
              <p className="text-xs text-muted-foreground">Open your data from this folder in the analysis software.</p>
            </div>
            <div className="space-y-2.5 rounded-lg border border-emerald-300/60 bg-emerald-50/70 p-3.5 text-sm text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:text-emerald-50">
              {pickerSupported ? (
                <>
                  <p className="flex items-center gap-1.5 font-medium">
                    <FolderOutput className="h-4 w-4" aria-hidden />
                    Save your results anywhere on the Analysis PC
                  </p>
                  <p className="leading-relaxed" data-testid="results-explainer">
                    When you end the session, you choose the folders or files you saved results in. They are copied to{" "}
                    <strong data-testid="destination-label">{destination}</strong>, then removed from the Analysis PC once the copy
                    is verified.
                  </p>
                </>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 font-medium">
                    <FolderOutput className="h-4 w-4" aria-hidden />
                    On the Analysis PC, save everything you want to keep in:
                  </p>
                  {pcOutputPath ? (
                    <CopyPath path={pcOutputPath} testId="pc-output-path" label="output folder" />
                  ) : (
                    <p className="rounded-md border bg-background px-2.5 py-1.5 text-xs">
                      The <strong>Output</strong> folder. Its full path is shown once the Analysis PC is ready.
                    </p>
                  )}
                  <p className="leading-relaxed">
                    When you end the session, this folder is copied to <strong data-testid="destination-label">{destination}</strong>
                    {useResearch ? " automatically" : ""}.{" "}
                    {autoDelete ? "Once the copy is verified, it is removed from the Analysis PC. " : ""}
                    Files saved anywhere else on the PC are not kept.
                  </p>
                </>
              )}
            </div>
          </section>

          {error ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="items-center gap-2 border-t px-6 py-4 sm:space-x-0">
          {blockedHint ? <p className="mr-auto text-xs text-muted-foreground">{blockedHint}</p> : <span className="mr-auto" />}
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={step === "saving" || step === "finalizing" || step === "opening" || uploads.busy}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void prepare()}
            disabled={!canPrepare}
            className="min-w-[150px] gap-2 bg-[#0b3d91] hover:bg-[#0a357f] dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            {working && !(step === "uploading" && canPrepare) ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {step === "saving"
              ? "Saving…"
              : step === "uploading"
                ? canPrepare
                  ? "Continue with uploaded files"
                  : "Uploading…"
                : step === "finalizing"
                  ? "Preparing…"
                  : step === "opening"
                    ? "Opening…"
                    : "Prepare & Open"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
