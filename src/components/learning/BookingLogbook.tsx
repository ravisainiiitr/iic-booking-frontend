import { useCallback, useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { learningApi, type LogbookEntry } from "@/lib/learningApi";
import { cn } from "@/lib/utils";

const KIND_STYLE: Record<string, string> = {
  ISSUE: "text-red-700 dark:text-red-300",
  SAFETY: "text-amber-700 dark:text-amber-300",
};

/** The booking's digital logbook: run parameters, notes, problems and safety observations. Entries are permanent. */
export function BookingLogbook({ bookingId }: { bookingId: number }) {
  const [rows, setRows] = useState<LogbookEntry[] | null>(null);
  const [kinds, setKinds] = useState<Array<{ value: string; label: string }>>([]);
  const [kind, setKind] = useState("NOTE");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await learningApi.logbook(bookingId);
    if (res.error) {
      setError(res.status === 403 ? "" : res.error);
      setRows(res.status === 403 ? null : []);
      return;
    }
    setRows(res.data?.results ?? []);
    setKinds(res.data?.kinds ?? []);
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (rows === null) return error ? <p className="text-sm text-destructive">{error}</p> : null;

  const add = async () => {
    setBusy(true);
    const res = await learningApi.addLogbookEntry(bookingId, kind, text.trim());
    setBusy(false);
    if (res.error) return void toast.error(res.error);
    if (kind === "ISSUE" || kind === "SAFETY") toast.success("Recorded. The equipment's staff have been told.");
    setText("");
    void load();
  };

  return (
    <div className="mt-4 space-y-2 rounded-lg border p-3" data-testid="booking-logbook">
      <p className="flex items-center gap-2 text-sm font-medium">
        <NotebookPen className="h-4 w-4" aria-hidden />
        Logbook
      </p>
      {rows.length ? (
        <ul className="space-y-1.5 text-sm">
          {rows.map((e) => (
            <li key={e.id}>
              <span className={cn("font-medium", KIND_STYLE[e.kind])}>{e.kind_label}</span>
              <span className="text-xs text-muted-foreground">
                {" "}
                · {e.author?.name ?? "—"} · {new Date(e.created_at).toLocaleString()}
              </span>
              <div className="whitespace-pre-wrap">{e.text}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No entries yet. Record run parameters, observations or problems here.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor={`logbook-kind-${bookingId}`} className="text-xs">
            Entry
          </Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger id={`logbook-kind-${bookingId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kinds.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`logbook-text-${bookingId}`} className="text-xs">
            Text
          </Label>
          <Textarea id={`logbook-text-${bookingId}`} rows={1} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <Button type="button" size="sm" onClick={() => void add()} disabled={busy || !text.trim()}>
          Add entry
        </Button>
      </div>
    </div>
  );
}
