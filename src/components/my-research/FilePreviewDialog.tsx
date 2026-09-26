import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { ResearchFile } from "@/lib/myResearchTypes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "./researchUtils";

const CSV_PREVIEW_ROWS = 200;

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < CSV_PREVIEW_ROWS; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if ((cell || row.length) && rows.length < CSV_PREVIEW_ROWS) rows.push([...row, cell]);
  return rows;
}

interface Props {
  file: ResearchFile | null;
  onOpenChange: (open: boolean) => void;
  onDownload: (file: ResearchFile) => void;
}

export function FilePreviewDialog({ file, onOpenChange, onDownload }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<{ content: string; truncated: boolean; kind: "text" | "csv" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUrl(null);
    setText(null);
    setError(null);
    if (!file) return;
    let alive = true;
    setLoading(true);
    const load = async () => {
      if (file.preview_kind === "pdf" || file.preview_kind === "image") {
        const res = await apiClient.getResearchFileUrl(file.id, "inline");
        if (!alive) return;
        if (res.error || !res.data) setError(res.error || "Preview is not available.");
        else if (res.data.disposition !== "inline") setError("This file cannot be previewed safely. Download it instead.");
        else setUrl(res.data.url);
      } else if (file.preview_kind === "text" || file.preview_kind === "csv") {
        const res = await apiClient.getResearchFileTextPreview(file.id);
        if (!alive) return;
        if (res.error || !res.data) setError(res.error || "Preview is not available.");
        else setText(res.data);
      } else {
        setError("No preview for this file type. Download it to open it on your computer.");
      }
      setLoading(false);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [file]);

  const csvRows = useMemo(() => {
    if (!text || text.kind !== "csv" || !file) return null;
    const delimiter = file.name.toLowerCase().endsWith(".tsv") ? "\t" : ",";
    return parseCsv(text.content, delimiter);
  }, [text, file]);

  return (
    <Dialog open={file != null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-3 sm:max-w-5xl">
        <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 pr-8">
          <div className="min-w-0">
            <DialogTitle className="truncate">{file?.name}</DialogTitle>
            <DialogDescription>{file ? formatBytes(file.size_bytes) : ""}</DialogDescription>
          </div>
          {file ? (
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => onDownload(file)}>
              <Download className="h-4 w-4" /> Download
            </Button>
          ) : null}
        </DialogHeader>
        <div className="min-h-[50vh] flex-1 overflow-auto rounded-md border bg-muted/30">
          {loading ? (
            <div className="flex h-full min-h-[50vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="flex h-full min-h-[50vh] items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : url && file?.preview_kind === "pdf" ? (
            <iframe title={file.name} src={url} className="h-[75vh] w-full bg-white" />
          ) : url && file?.preview_kind === "image" ? (
            <div className="flex min-h-[50vh] items-center justify-center p-4">
              <img src={url} alt={file.name} className="max-h-[75vh] max-w-full object-contain" />
            </div>
          ) : csvRows ? (
            <table className="w-full border-collapse text-xs">
              <tbody>
                {csvRows.map((row, i) => (
                  <tr key={i} className={i === 0 ? "sticky top-0 bg-muted font-semibold" : "odd:bg-background"}>
                    {row.map((cell, j) => (
                      <td key={j} className="whitespace-nowrap border px-2 py-1">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : text ? (
            <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs">{text.content}</pre>
          ) : null}
        </div>
        {text?.truncated || (csvRows && csvRows.length >= CSV_PREVIEW_ROWS) ? (
          <p className="text-xs text-muted-foreground">Showing the beginning of the file only. Download it to see everything.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
