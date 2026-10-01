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
        className="border-primary/30 text-primary hover:bg-primary/5 dark:border-primary/50 dark:text-sky-300 dark:hover:bg-primary/10"
        title="Save your own files for this booking in a private My Research project"
        onClick={() => setOpen(true)}
      >
        <FlaskConical className="mr-2 h-4 w-4" />
        Save to project
      </Button>
      <UploadToMyResearchDialog bookingId={bookingId} bookingLabel={bookingLabel} open={open} onOpenChange={setOpen} />
    </>
  );
}
