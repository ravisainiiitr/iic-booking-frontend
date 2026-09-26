import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadToMyResearchDialog } from "./UploadToMyResearchDialog";
import { useMyResearchAvailability } from "./useMyResearchAvailability";

interface Props {
  bookingId: number;
  bookingLabel: string;
}

/** Renders nothing unless My Research is enabled and the user is eligible. */
export function UploadToMyResearchButton({ bookingId, bookingLabel }: Props) {
  const { available } = useMyResearchAvailability();
  const [open, setOpen] = useState(false);
  if (!available) return null;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
        title="Save your own files for this booking in a private My Research workspace"
        onClick={() => setOpen(true)}
      >
        <FlaskConical className="mr-2 h-4 w-4" />
        Upload to My Research
      </Button>
      <UploadToMyResearchDialog bookingId={bookingId} bookingLabel={bookingLabel} open={open} onOpenChange={setOpen} />
    </>
  );
}
