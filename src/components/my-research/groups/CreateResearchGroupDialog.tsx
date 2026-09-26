import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchGroupCardData } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (group: ResearchGroupCardData) => void;
  /** When set, the dialog edits this group instead of creating one. */
  group?: Pick<ResearchGroupCardData, "id" | "name" | "short_code" | "description"> | null;
}

export function CreateResearchGroupDialog({ open, onOpenChange, onSaved, group }: Props) {
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(group);

  useEffect(() => {
    if (open) {
      setName(group?.name ?? "");
      setShortCode(group?.short_code ?? "");
      setDescription(group?.description ?? "");
    }
  }, [open, group]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const payload = { name: name.trim(), short_code: shortCode.trim(), description: description.trim() };
    const res = group ? await apiClient.updateResearchGroup(group.id, payload) : await apiClient.createResearchGroup(payload);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the research group.");
      return;
    }
    toast.success(editing ? "Group updated" : "Research group created");
    onSaved(res.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit research group" : "New research group"}</DialogTitle>
            <DialogDescription>
              A group organises your students, their activities and progress updates. Membership does not give access to
              research workspaces; workspaces are still shared individually.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-[1fr,140px]">
            <div className="space-y-1.5">
              <Label htmlFor="rg-name">Group name</Label>
              <Input
                id="rg-name"
                value={name}
                maxLength={200}
                autoFocus
                placeholder="e.g. Nanomaterials Research Lab"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-code">Short code (optional)</Label>
              <Input id="rg-code" value={shortCode} maxLength={20} placeholder="NML" onChange={(e) => setShortCode(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rg-desc">Description (optional)</Label>
            <Textarea
              id="rg-desc"
              value={description}
              maxLength={5000}
              rows={3}
              placeholder="Research focus, funding project…"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {editing ? "Save" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
