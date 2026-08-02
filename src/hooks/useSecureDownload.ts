import { useCallback, useRef, useState } from "react";
import { pushDownloadHistory, loadDownloadHistory } from "@/components/downloads/downloadHistory";
import {
  DEFAULT_DOWNLOAD_STEPS,
  type DownloadHistoryEntry,
  type DownloadPhase,
  type DownloadStep,
  type DownloadStepId,
  type SecureDownloadRequest,
} from "@/components/downloads/types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function initialSteps(): DownloadStep[] {
  return DEFAULT_DOWNLOAD_STEPS.map((s, i) => ({
    ...s,
    state: i === 0 ? "active" : "pending",
  }));
}

function markSteps(steps: DownloadStep[], upTo: DownloadStepId, active?: DownloadStepId): DownloadStep[] {
  const order = DEFAULT_DOWNLOAD_STEPS.map((s) => s.id);
  const doneIdx = order.indexOf(upTo);
  const activeIdx = active ? order.indexOf(active) : -1;
  return steps.map((s) => {
    const idx = order.indexOf(s.id);
    if (idx < doneIdx || (active && idx < activeIdx && idx <= doneIdx)) {
      return { ...s, state: "done" };
    }
    if (active && s.id === active) return { ...s, state: "active" };
    if (!active && s.id === upTo) return { ...s, state: "done" };
    if (idx > Math.max(doneIdx, activeIdx)) return { ...s, state: "pending" };
    return s;
  });
}

export type UseSecureDownloadOptions = {
  downloadedBy?: string;
};

export function useSecureDownload(options: UseSecureDownloadOptions = {}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<DownloadPhase>("idle");
  const [steps, setSteps] = useState<DownloadStep[]>(initialSteps);
  const [progress, setProgress] = useState(0);
  const [bytesLoaded, setBytesLoaded] = useState(0);
  const [bytesTotal, setBytesTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState("");
  const [resultSha, setResultSha] = useState("");
  const [resultSize, setResultSize] = useState(0);
  const [activeRequest, setActiveRequest] = useState<SecureDownloadRequest | null>(null);
  const [history, setHistory] = useState<DownloadHistoryEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const lastBlobRef = useRef<Blob | null>(null);
  const lastUrlRef = useRef<string>("");
  const lastFilenameRef = useRef("");

  const refreshHistory = useCallback((productKey?: string) => {
    setHistory(loadDownloadHistory(productKey));
  }, []);

  const resetUi = useCallback(() => {
    setPhase("idle");
    setSteps(initialSteps());
    setProgress(0);
    setBytesLoaded(0);
    setBytesTotal(null);
    setError(null);
    setErrorDetail(null);
    setResultFilename("");
    setResultSha("");
    setResultSize(0);
  }, []);

  const triggerBrowserSave = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, []);

  const triggerNativeUrlDownload = useCallback((url: string, filename: string) => {
    // Prefer a same-tab navigation for cross-origin (S3) URLs so the browser
    // uses Content-Disposition from object storage. The download attribute is
    // ignored for cross-origin hrefs and only helps same-origin ticket URLs.
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    if (filename && !/^https?:\/\/.+\.amazonaws\.com\//i.test(url)) {
      a.download = filename;
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const run = useCallback(
    async (request: SecureDownloadRequest) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setActiveRequest(request);
      setOpen(true);
      resetUi();
      setPhase("preparing");
      setBytesTotal(request.meta.download_size_bytes || null);
      refreshHistory(request.productKey);

      try {
        setSteps((s) => markSteps(s, "validate", "validate"));
        setProgress(10);
        await sleep(100);
        if (ac.signal.aborted) return;

        if (request.kind === "online" && !request.meta.has_file) {
          throw Object.assign(new Error("Installer file is not published yet."), {
            detail: "No online setup EXE is attached to the latest release.",
          });
        }
        if (request.kind === "offline" && !request.meta.has_offline_file) {
          throw Object.assign(new Error("Offline package is not available."), {
            detail: "Publish an offline ZIP with the release to enable this download.",
          });
        }

        setSteps((s) => markSteps(s, "validate", "metadata"));
        setProgress(25);
        await sleep(80);

        setSteps((s) => markSteps(s, "metadata", "checksum"));
        setProgress(40);
        await sleep(80);

        setSteps((s) => markSteps(s, "checksum", "prepare"));
        setProgress(55);
        await sleep(60);

        // Fast path: short-lived ticket → native browser download (preferred for large EXEs)
        if (request.startNativeDownload) {
          setSteps((s) => markSteps(s, "prepare", "transfer"));
          setPhase("transferring");
          setProgress(70);

          try {
            const ticket = await request.startNativeDownload({ signal: ac.signal });
            if (ac.signal.aborted) return;

            lastUrlRef.current = ticket.url;
            lastFilenameRef.current = ticket.filename;
            lastBlobRef.current = null;

            const size = ticket.sizeBytes || request.meta.download_size_bytes || 0;
            const sha = ticket.sha256 || request.meta.sha256 || "";

            setSteps((s) => markSteps(s, "transfer", "browser"));
            setPhase("starting");
            setProgress(92);
            setResultFilename(ticket.filename);
            setResultSha(sha);
            setResultSize(size);
            setBytesLoaded(size);
            setBytesTotal(size || null);

            await sleep(80);
            triggerNativeUrlDownload(ticket.url, ticket.filename);

            setSteps((s) => markSteps(s, "browser"));
            setProgress(100);
            setPhase("success");

            const hist = pushDownloadHistory({
              productKey: request.productKey,
              productLabel: request.productLabel,
              version: ticket.version || request.meta.version || "—",
              filename: ticket.filename,
              sizeBytes: size,
              sha256: sha,
              kind: request.kind,
              downloadedAt: new Date().toISOString(),
              downloadedBy: options.downloadedBy,
            });
            setHistory(hist);
            return;
          } catch (ticketErr) {
            // Older backends without ticket endpoint — fall through to fetchArtifact
            if (!request.fetchArtifact) throw ticketErr;
          }
        }

        if (!request.fetchArtifact) {
          throw new Error("No download method configured.");
        }

        // Fallback: buffer via fetch (slower for large packages)
        setSteps((s) => markSteps(s, "prepare", "transfer"));
        setPhase("transferring");
        setProgress(34);
        const expectedTotal = request.meta.download_size_bytes || null;

        const artifact = await request.fetchArtifact({
          signal: ac.signal,
          onProgress: (loaded, total) => {
            setBytesLoaded(loaded);
            const denom = (total && total > 0 ? total : expectedTotal) || 0;
            if (denom > 0) {
              setBytesTotal(denom);
              const pct = 34 + Math.min(58, Math.round((loaded / denom) * 58));
              setProgress(pct);
            } else {
              setProgress((p) => Math.min(90, Math.max(p, 34 + Math.min(50, loaded / (1024 * 1024)))));
            }
          },
        });

        if (ac.signal.aborted) return;

        lastBlobRef.current = artifact.blob;
        lastFilenameRef.current = artifact.filename;
        lastUrlRef.current = "";
        const size = artifact.sizeBytes || artifact.blob.size || request.meta.download_size_bytes || 0;
        const sha = artifact.sha256 || request.meta.sha256 || "";

        setSteps((s) => markSteps(s, "transfer", "browser"));
        setPhase("starting");
        setProgress(96);
        setResultFilename(artifact.filename);
        setResultSha(sha);
        setResultSize(size);
        setBytesLoaded(size);
        setBytesTotal(size || null);

        await sleep(120);
        triggerBrowserSave(artifact.blob, artifact.filename);

        setSteps((s) => markSteps(s, "browser"));
        setProgress(100);
        setPhase("success");

        const hist = pushDownloadHistory({
          productKey: request.productKey,
          productLabel: request.productLabel,
          version: request.meta.version || "—",
          filename: artifact.filename,
          sizeBytes: size,
          sha256: sha,
          kind: request.kind,
          downloadedAt: new Date().toISOString(),
          downloadedBy: options.downloadedBy,
        });
        setHistory(hist);
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        const err = e as { message?: string; detail?: string; name?: string };
        if (err?.name === "AbortError") return;
        setPhase("error");
        setError(err?.message || "Unable to prepare installer.");
        setErrorDetail(err?.detail || (typeof e === "string" ? e : null));
        setSteps((prev) =>
          prev.map((s) => (s.state === "active" ? { ...s, state: "error" } : s)),
        );
      }
    },
    [options.downloadedBy, refreshHistory, resetUi, triggerBrowserSave, triggerNativeUrlDownload],
  );

  const downloadAgain = useCallback(() => {
    if (lastBlobRef.current && lastFilenameRef.current) {
      triggerBrowserSave(lastBlobRef.current, lastFilenameRef.current);
      setPhase("success");
      return;
    }
    if (lastUrlRef.current && lastFilenameRef.current) {
      // Ticket may still be valid; otherwise re-run.
      triggerNativeUrlDownload(lastUrlRef.current, lastFilenameRef.current);
      setPhase("success");
      return;
    }
    if (activeRequest) void run(activeRequest);
  }, [activeRequest, run, triggerBrowserSave, triggerNativeUrlDownload]);

  const retry = useCallback(() => {
    if (activeRequest) void run(activeRequest);
  }, [activeRequest, run]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
    setPhase("idle");
  }, []);

  const close = useCallback(() => {
    if (phase === "preparing" || phase === "transferring" || phase === "starting") {
      abortRef.current?.abort();
    }
    setOpen(false);
  }, [phase]);

  return {
    open,
    setOpen,
    phase,
    steps,
    progress,
    bytesLoaded,
    bytesTotal,
    error,
    errorDetail,
    resultFilename,
    resultSha,
    resultSize,
    activeRequest,
    history,
    refreshHistory,
    run,
    retry,
    downloadAgain,
    cancel,
    close,
    isBusy: phase === "preparing" || phase === "transferring" || phase === "starting",
  };
}
