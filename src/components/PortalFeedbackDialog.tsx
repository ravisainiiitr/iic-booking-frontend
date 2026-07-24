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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Ratings = {
  overall_rating: number;
  ease_of_booking: number;
  website_usability: number;
  equipment_booking_experience: number;
};

const RATING_FIELDS: { key: keyof Ratings; label: string; hint: string }[] = [
  { key: "overall_rating", label: "Overall experience", hint: "How satisfied are you with the portal overall?" },
  { key: "ease_of_booking", label: "Ease of booking", hint: "How easy is it to find slots and complete a booking?" },
  { key: "website_usability", label: "Website usability", hint: "Navigation, clarity, and layout of the site." },
  {
    key: "equipment_booking_experience",
    label: "Equipment booking experience",
    hint: "Charges, accessories, sample flow, and lab coordination.",
  },
];

function StarRow({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="rounded p-0.5 hover:scale-110 transition-transform"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "h-6 w-6",
              n <= value ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
      <span className="ml-2 text-xs text-muted-foreground">{value ? `${value}/5` : "Select"}</span>
    </div>
  );
}

interface PortalFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PortalFeedbackDialog({ open, onOpenChange }: PortalFeedbackDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Ratings>({
    overall_rating: 0,
    ease_of_booking: 0,
    website_usability: 0,
    equipment_booking_experience: 0,
  });
  const [suggestions, setSuggestions] = useState("");
  const [comments, setComments] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.getMyPortalFeedback();
        if (cancelled) return;
        const fb = res.data?.feedback;
        if (fb) {
          setExistingId(fb.feedback_id);
          setRatings({
            overall_rating: fb.overall_rating,
            ease_of_booking: fb.ease_of_booking,
            website_usability: fb.website_usability,
            equipment_booking_experience: fb.equipment_booking_experience,
          });
          setSuggestions(fb.suggestions || "");
          setComments(fb.comments || "");
        } else {
          setExistingId(null);
          setRatings({
            overall_rating: 0,
            ease_of_booking: 0,
            website_usability: 0,
            equipment_booking_experience: 0,
          });
          setSuggestions("");
          setComments("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSave = async () => {
    for (const f of RATING_FIELDS) {
      if (!ratings[f.key]) {
        toast.error(`Please rate: ${f.label}`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await apiClient.upsertMyPortalFeedback({
        ...ratings,
        suggestions: suggestions.trim(),
        comments: comments.trim(),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(existingId ? "Feedback updated. Thank you!" : "Feedback submitted. Thank you!");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingId ? "Update your feedback" : "Share your experience"}</DialogTitle>
          <DialogDescription>
            Help us improve the Online Equipment Booking System. You can update your ratings anytime.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : (
          <div className="space-y-5 py-1">
            {RATING_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-sm font-medium">{f.label}</Label>
                <p className="text-xs text-muted-foreground">{f.hint}</p>
                <StarRow
                  label={f.label}
                  value={ratings[f.key]}
                  onChange={(n) => setRatings((r) => ({ ...r, [f.key]: n }))}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <Label htmlFor="fb-suggestions">Suggestions for improvement</Label>
              <Textarea
                id="fb-suggestions"
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                placeholder="What should we improve next?"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-comments">Additional comments (optional)</Label>
              <Textarea
                id="fb-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Anything else you'd like us to know…"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-primary hover:bg-primary/90"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "Saving…" : existingId ? "Update feedback" : "Submit feedback"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
