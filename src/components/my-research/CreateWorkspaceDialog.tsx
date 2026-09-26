import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchWorkspaceCard } from "@/lib/myResearchTypes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workspace: ResearchWorkspaceCard) => void;
  initial?: { name: string; description: string } | null;
  workspaceId?: string;
}

export function CreateWorkspaceDialog({ open, onOpenChange, onCreated, initial, workspaceId }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(workspaceId);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
    }
  }, [open, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() };
    const res = workspaceId
      ? await apiClient.updateResearchWorkspace(workspaceId, payload)
      : await apiClient.createResearchWorkspace(payload);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the workspace.");
      return;
    }
    toast.success(editing ? "Workspace updated" : "Workspace created");
    onCreated(res.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit workspace" : "New research workspace"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the name or description of this workspace."
                : "A private place for one research project: files, bookings, equipment, and publications."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="mr-ws-name">Project name</Label>
            <Input
              id="mr-ws-name"
              value={name}
              maxLength={200}
              autoFocus
              placeholder="e.g. Development of Nanocomposite Coating"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mr-ws-desc">Description (optional)</Label>
            <Textarea
              id="mr-ws-desc"
              value={description}
              maxLength={5000}
              rows={4}
              placeholder="Aim, sample types, collaborators…"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
