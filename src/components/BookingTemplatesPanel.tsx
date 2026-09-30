import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { BookmarkCheck, CalendarCheck, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type BookingTemplate, type BookingTemplateOptions } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const OPTION_LABELS: Array<[keyof BookingTemplateOptions, string]> = [
  ["auto_slot_selection", "Auto-select slots"],
  ["book_any_available_slots", "Book any available slots"],
  ["book_even_if_single_slot_available", "Single slot is fine"],
  ["waitlist_on_failure", "Waitlist if unsuccessful"],
  ["auto_allocate_alternative", "Auto-allocate alternate equipment"],
  ["sample_return_after_analysis", "Return sample"],
  ["atmosphere_sensitive_sample", "Atmosphere-sensitive sample"],
];

const filledInputCount = (values: Record<string, unknown>) =>
  Object.entries(values || {}).filter(([key, v]) => {
    if (key === "comments") return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;

const formatUpdated = (iso: string | null) => {
  if (!iso) return null;
  try {
    return format(parseISO(iso), "d MMM yyyy, HH:mm");
  } catch {
    return null;
  }
};

/** The signed-in user's booking templates for one equipment (equipment profile menu). */
export function BookingTemplatesPanel({ equipmentId, canBook }: { equipmentId: number; canBook: boolean }) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<BookingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<BookingTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.listBookingTemplates(equipmentId);
    if (res.error) toast.error(res.error);
    setTemplates(res.data?.templates ?? []);
    setLoading(false);
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createUrl = `/book-equipment?equipment_id=${equipmentId}&mode=template`;

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await apiClient.deleteBookingTemplate(pendingDelete.id);
    setDeleting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Template "${pendingDelete.name}" deleted.`);
    setPendingDelete(null);
    void load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Save your usual sample details and booking options under a name. When booking, choose the template to fill
          the whole form in one step, then just pick your slots. Useful when slots open and go quickly.
        </p>
        <Button type="button" onClick={() => navigate(createUrl)}>
          <Plus className="mr-2 h-4 w-4" />
          Create template
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading templates…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <BookmarkCheck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">No booking templates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one from the booking form: fill the details and options once, then save them under a name.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => {
            const updated = formatUpdated(t.updated_at);
            const inputs = filledInputCount(t.input_values);
            const optionBadges = OPTION_LABELS.filter(([key]) => t.options?.[key] === true);
            return (
              <li key={t.id} className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{t.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {inputs} input{inputs === 1 ? "" : "s"} filled
                      {updated ? ` · Updated ${updated}` : ""}
                    </p>
                    {optionBadges.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {optionBadges.map(([key, label]) => (
                          <Badge key={key} variant="secondary" className="font-normal">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canBook}
                      title={canBook ? undefined : "Booking is disabled for this equipment right now."}
                      onClick={() => navigate(`/book-equipment?equipment_id=${equipmentId}&template=${t.id}`)}
                    >
                      <CalendarCheck className="mr-1.5 h-4 w-4" />
                      Book with this template
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate(`/book-equipment?equipment_id=${equipmentId}&mode=template&template_id=${t.id}`)
                      }
                    >
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(t)}
                      aria-label={`Delete template ${t.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will be removed. Your bookings are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default BookingTemplatesPanel;
