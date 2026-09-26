import { useCallback, useEffect, useRef, useState } from "react";
import type { ResearchFile } from "@/lib/myResearchTypes";
import { ResearchUploadCancelled, startResearchUpload, type ResearchUploadStage } from "@/lib/myResearchUpload";

const MAX_PARALLEL_FILES = 2;

export interface QueuedUpload {
  id: string;
  file: File;
  folderId: string | null;
  bookingId: number | null;
  status: "queued" | ResearchUploadStage | "done" | "failed" | "cancelled";
  loaded: number;
  error?: string;
  result?: ResearchFile;
}

export function useResearchUploads(workspaceId: string | null, onUploaded?: (file: ResearchFile) => void) {
  const [items, setItems] = useState<QueuedUpload[]>([]);
  const cancels = useRef(new Map<string, () => void>());
  const running = useRef(new Set<string>());
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const patch = useCallback((id: string, update: Partial<QueuedUpload>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }, []);

  const addFiles = useCallback((files: File[], target: { folderId?: string | null; bookingId?: number | null } = {}) => {
    const added = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      folderId: target.folderId ?? null,
      bookingId: target.bookingId ?? null,
      status: "queued" as const,
      loaded: 0,
    }));
    setItems((prev) => [...prev, ...added]);
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    const free = MAX_PARALLEL_FILES - running.current.size;
    if (free <= 0) return;
    const next = items.filter((item) => item.status === "queued" && !running.current.has(item.id)).slice(0, free);
    for (const item of next) {
      running.current.add(item.id);
      const handle = startResearchUpload({
        workspaceId,
        file: item.file,
        folderId: item.folderId,
        bookingId: item.bookingId,
        onStage: (stage) => patch(item.id, { status: stage }),
        onProgress: (loaded) => patch(item.id, { loaded }),
      });
      cancels.current.set(item.id, handle.cancel);
      handle.promise
        .then((result) => {
          patch(item.id, { status: "done", loaded: item.file.size, result });
          onUploadedRef.current?.(result);
        })
        .catch((err: unknown) => {
          if (err instanceof ResearchUploadCancelled) patch(item.id, { status: "cancelled" });
          else patch(item.id, { status: "failed", error: err instanceof Error ? err.message : "Upload failed." });
        })
        .finally(() => {
          running.current.delete(item.id);
          cancels.current.delete(item.id);
          setItems((prev) => [...prev]);
        });
    }
  }, [items, workspaceId, patch]);

  useEffect(() => {
    const active = cancels.current;
    return () => {
      active.forEach((cancel) => cancel());
    };
  }, []);

  const cancel = useCallback(
    (id: string) => {
      const fn = cancels.current.get(id);
      if (fn) fn();
      else patch(id, { status: "cancelled" });
    },
    [patch],
  );

  const retry = useCallback(
    (id: string) => patch(id, { status: "queued", loaded: 0, error: undefined }),
    [patch],
  );

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((item) => !["done", "failed", "cancelled"].includes(item.status)));
  }, []);

  const busy = items.some((item) => !["done", "failed", "cancelled"].includes(item.status));

  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  return { items, addFiles, cancel, retry, clearFinished, busy };
}
