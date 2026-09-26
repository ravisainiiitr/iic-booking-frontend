import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchBooking } from "@/lib/myResearchTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate } from "./researchUtils";

interface Props {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}

export function LinkBookingsDialog({ workspaceId, open, onOpenChange, onLinked }: Props) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ResearchBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setPicked(new Set());
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await apiClient.listLinkableResearchBookings(workspaceId, query.trim());
      if (!alive) return;
      setLoading(false);
      if (res.error) toast.error(res.error);
      else setItems(res.data?.results ?? []);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, query, workspaceId]);

  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    const res = await apiClient.linkResearchBookings(workspaceId, Array.from(picked));
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const count = res.data?.linked.length ?? 0;
    toast.success(count === 1 ? "Booking added to workspace" : `${count} bookings added to workspace`);
    onLinked();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add bookings</DialogTitle>
          <DialogDescription>
            Choose your own bookings to associate with this project. Bookings are not changed; only a link is saved.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by equipment name, code or booking ID"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No other bookings found.</p>
          ) : (
            <ul className="divide-y">
              {items.map((b) => (
                <li key={b.booking_id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/50">
                    <Checkbox
                      checked={picked.has(b.booking_id)}
                      onCheckedChange={() => toggle(b.booking_id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{b.equipment_name}</span>
                        <span className="text-xs text-muted-foreground">({b.equipment_code})</span>
                        <Badge variant="outline" className="text-[10px]">
                          {b.status_display}
                        </Badge>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {b.display_id} · {formatDate(b.booking_date)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || picked.size === 0} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add {picked.size > 0 ? picked.size : ""} booking{picked.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
