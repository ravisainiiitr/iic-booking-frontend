import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Download, ExternalLink, FolderDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ResultFile = {
  key: string;
  name: string;
  download_url: string;
  source?: string;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
  size_bytes?: number;
};

function formatSize(bytes?: number): string | null {
  if (typeof bytes !== "number" || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface BookingResultsDialogProps {
  bookingId: number | null;
  bookingLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called on close when at least one download succeeded (the booking is then marked viewed). */
  onDownloaded?: () => void;
}

export function BookingResultsDialog({
  bookingId,
  bookingLabel,
  open,
  onOpenChange,
  onDownloaded,
}: BookingResultsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<ResultFile[]>([]);
  const [error, setError] = useState<{ message: string; portalUrl?: string } | null>(null);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipInProgress, setZipInProgress] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!open || bookingId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFiles([]);
    setDownloaded(false);
    apiClient
      .getBookingResults(bookingId)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setError({ message: res.error, portalUrl: res.istem_portal_url });
          return;
        }
        setFiles(res.data?.files ?? []);
      })
      .catch(() => {
        if (!cancelled) setError({ message: "Could not load result files." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  const handleOpenChange = (next: boolean) => {
    if (!next && zipInProgress) return;
    onOpenChange(next);
    if (!next && downloaded) onDownloaded?.();
  };

  const downloadZip = async () => {
    if (bookingId == null) return;
    setZipInProgress(true);
    setZipProgress(8);
    const res = await apiClient.downloadBookingResultsZip(bookingId, undefined, (p) => setZipProgress(p));
    if (res.error) {
      toast.error(res.error);
      setZipInProgress(false);
      setZipProgress(0);
      return;
    }
    setDownloaded(true);
    toast.success("Download started. Save prompt should appear shortly.");
    setZipProgress(100);
    window.setTimeout(() => {
      setZipInProgress(false);
      setZipProgress(0);
    }, 700);
  };

  const downloadFile = async (file: ResultFile) => {
    const res = await apiClient.downloadBookingResultFile(file, bookingId);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setDownloaded(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Results{bookingLabel ? ` · ${bookingLabel}` : ""}</DialogTitle>
          <DialogDescription>
            Download the entire folder as ZIP, or individual files below.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error.message}</p>
            {error.portalUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={error.portalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open I-STEM portal
                </a>
              </Button>
            ) : null}
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No result files were found for this booking.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <Button className="w-full bg-green-600 hover:bg-green-700" disabled={zipInProgress} onClick={downloadZip}>
              <FolderDown className="h-4 w-4 mr-2" />
              {zipInProgress ? "Preparing ZIP..." : "Download folder (ZIP)"}
            </Button>
            {zipInProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Preparing and downloading ZIP...</span>
                  <span>{zipProgress}%</span>
                </div>
                <Progress value={zipProgress} className="h-2" />
              </div>
            )}
            <p className="text-sm font-medium">Individual files</p>
            <ul className="space-y-3 max-h-72 overflow-y-auto">
              {files.map((file, idx) => (
                <li key={file.key || `${file.name}-${idx}`} className="rounded-md border px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-all">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          file.uploaded_by ? `Uploaded by ${file.uploaded_by}` : null,
                          file.uploaded_at ? new Date(file.uploaded_at).toLocaleString() : null,
                          formatSize(file.size_bytes),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => downloadFile(file)}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BookingResultsDialog;
