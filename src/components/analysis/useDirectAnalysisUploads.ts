import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import type { QueuedUpload } from "@/components/my-research/useResearchUploads";

const MAX_PARALLEL_FILES = 2;

/** Upload queue for the booking's analysis input (users without My Research). Mirrors useResearchUploads. */
export function useDirectAnalysisUploads(bookingId: number) {
  const [items, setItems] = useState<QueuedUpload[]>([]);
  const aborts = useRef(new Map<string, AbortController>());

  const patch = useCallback((id: string, update: Partial<QueuedUpload>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    setItems((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        folderId: null,
        bookingId,
        status: "queued" as const,
        loaded: 0,
      })),
    ]);
  }, [bookingId]);

  useEffect(() => {
    const free = MAX_PARALLEL_FILES - aborts.current.size;
    if (free <= 0) return;
    const next = items.filter((item) => item.status === "queued" && !aborts.current.has(item.id)).slice(0, free);
    for (const item of next) {
      const controller = new AbortController();
      aborts.current.set(item.id, controller);
      patch(item.id, { status: "uploading" });
      void apiClient
        .uploadBookingAnalysisFileWithProgress(bookingId, item.file, (loaded) => patch(item.id, { loaded }), controller.signal)
        .then((res) => {
          if (res.errorCode === "cancelled") patch(item.id, { status: "cancelled" });
          else if (res.error) patch(item.id, { status: "failed", error: res.error });
          else patch(item.id, { status: "done", loaded: item.file.size });
        })
        .finally(() => {
          aborts.current.delete(item.id);
          setItems((prev) => [...prev]);
        });
    }
  }, [items, bookingId, patch]);

  useEffect(() => {
    const active = aborts.current;
    return () => active.forEach((controller) => controller.abort());
  }, []);

  const cancel = useCallback(
    (id: string) => {
      const controller = aborts.current.get(id);
      if (controller) controller.abort();
      else patch(id, { status: "cancelled" });
    },
    [patch],
  );

  const retry = useCallback((id: string) => patch(id, { status: "queued", loaded: 0, error: undefined }), [patch]);

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((item) => !["done", "failed", "cancelled"].includes(item.status)));
  }, []);

  const busy = items.some((item) => !["done", "failed", "cancelled"].includes(item.status));

  return { items, addFiles, cancel, retry, clearFinished, busy };
}
