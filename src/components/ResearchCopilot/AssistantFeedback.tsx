import { useId, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "idle" | "up" | "ask" | "done";

type Props = {
  /** Saves the rating; resolves to the stored feedback id, or null when it could not be saved. */
  onRate: (rating: "up" | "down") => Promise<string | null>;
  /** Adds the optional "What were you looking for?" note to the saved thumbs-down. */
  onComment: (feedbackId: string, comment: string) => Promise<boolean>;
  canEscalate?: boolean;
  onEscalate?: (note?: string) => void;
  initialStep?: Step;
};

/** "Was this helpful?" thumbs under an assistant answer, with an optional one-line note after a thumbs-down. */
export function AssistantFeedback({ onRate, onComment, canEscalate = false, onEscalate, initialStep = "idle" }: Props) {
  const [step, setStep] = useState<Step>(initialStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const inputId = useId();

  const rate = async (rating: "up" | "down") => {
    if (busy) return;
    setBusy(true);
    setError(false);
    const id = await onRate(rating);
    setBusy(false);
    if (!id) {
      setError(true);
      return;
    }
    setFeedbackId(id);
    setStep(rating === "up" ? "up" : "ask");
  };

  const sendNote = async () => {
    const text = note.trim();
    if (!text || !feedbackId) {
      setStep("done");
      return;
    }
    setBusy(true);
    const ok = await onComment(feedbackId, text);
    setBusy(false);
    if (ok) setStep("done");
    else setError(true);
  };

  if (step === "up") {
    return <p className="mt-2 text-[11px] text-muted-foreground" role="status">Thanks for the feedback.</p>;
  }

  if (step === "ask") {
    return (
      <form
        className="mt-2 space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void sendNote();
        }}
      >
        <label htmlFor={inputId} className="block text-[11px] font-medium">
          Thanks. What were you looking for? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="flex gap-1.5">
          <Input
            id={inputId}
            value={note}
            maxLength={300}
            placeholder="e.g. XRD sample prep for thin films"
            onChange={(e) => setNote(e.target.value)}
            className="h-8 flex-1 text-xs"
            disabled={busy}
          />
          <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={busy || !note.trim()}>
            Send
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setStep("done")}>
            Skip
          </Button>
        </div>
        {error ? <p className="text-[11px] text-destructive" role="alert">Couldn&apos;t save your note. Please try again.</p> : null}
      </form>
    );
  }

  if (step === "done") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground" role="status">
        <span>Thanks — this helps us improve the assistant.</span>
        {canEscalate && onEscalate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-full px-2.5 text-[11px]"
            onClick={() => onEscalate(note.trim() || undefined)}
          >
            Ask the IIC team
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground" role="group" aria-label="Was this helpful?">
      <span className="mr-1">Was this helpful?</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 gap-1 px-2 text-[11px]"
        aria-label="Yes, this was helpful"
        disabled={busy}
        onClick={() => void rate("up")}
      >
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> Yes
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 gap-1 px-2 text-[11px]"
        aria-label="No, this was not helpful"
        disabled={busy}
        onClick={() => void rate("down")}
      >
        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" /> No
      </Button>
      {error ? <span className="ml-1 text-destructive" role="alert">Couldn&apos;t save — try again.</span> : null}
    </div>
  );
}
