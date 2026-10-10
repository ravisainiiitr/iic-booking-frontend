import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getInitials } from "@/lib/displayName";
import { cn } from "@/lib/utils";

const PORTRAIT = "w-28 sm:w-[7.5rem] aspect-[4/5] shrink-0 rounded-lg border";

/** Passport-size ID-card photo: click to enlarge; initials when there is no photo or it fails to load. */
export default function IdPhoto({
  url,
  name,
  email,
  caption,
  fallbackTestId,
}: {
  url: string | null | undefined;
  name: string;
  email?: string;
  /** Shown under the name in the enlarged view. */
  caption: string;
  fallbackTestId?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const photo = url && !failed ? url : null;
  if (!photo) {
    return (
      <div
        className={cn(
          PORTRAIT,
          "flex items-center justify-center bg-gradient-to-br from-primary/15 to-violet-500/15 text-3xl font-semibold text-primary dark:text-sky-300",
        )}
        role="img"
        aria-label={`No photo for ${name}`}
        data-testid={fallbackTestId}
      >
        {getInitials(name, { email, max: 2 })}
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        className={cn(
          PORTRAIT,
          "group relative overflow-hidden bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onClick={() => setPreviewOpen(true)}
        aria-label={`Enlarge photo of ${name}`}
        title="View larger photo"
      >
        <img src={photo} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
        <span
          className="absolute bottom-1 right-1 rounded bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          <Maximize2 className="h-3 w-3" />
        </span>
      </button>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>{caption}</DialogDescription>
          </DialogHeader>
          <img src={photo} alt={name} className="max-h-[70vh] w-full rounded-lg border bg-muted object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}
