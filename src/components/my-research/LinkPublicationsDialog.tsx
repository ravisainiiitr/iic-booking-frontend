import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchPublication } from "@/lib/myResearchTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}

export function LinkPublicationsDialog({ workspaceId, open, onOpenChange, onLinked }: Props) {
  const [items, setItems] = useState<ResearchPublication[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setPicked(new Set());
      return;
    }
    let alive = true;
    setLoading(true);
    void apiClient.listLinkableResearchPublications(workspaceId).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.error) toast.error(res.error);
      else setItems(res.data?.results ?? []);
    });
    return () => {
      alive = false;
    };
  }, [open, workspaceId]);

  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    const res = await apiClient.linkResearchPublications(workspaceId, Array.from(picked));
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Publications linked");
    onLinked();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link publications</DialogTitle>
          <DialogDescription>
            Pick from the publications you have submitted to IIC.{" "}
            <Link to="/my-publications" className="text-violet-700 underline underline-offset-2 dark:text-violet-300">
              Submit a new publication
            </Link>{" "}
            first if it is not listed.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No other publications to link.</p>
          ) : (
            <ul className="divide-y">
              {items.map((p) => (
                <li key={p.claim_id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/50">
                    <Checkbox checked={picked.has(p.claim_id)} onCheckedChange={() => toggle(p.claim_id)} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug">{p.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[p.journal, p.year].filter(Boolean).join(", ")}
                        {p.doi ? ` · DOI ${p.doi}` : ""}
                      </span>
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {p.status_display}
                      </Badge>
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
            Link {picked.size || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
