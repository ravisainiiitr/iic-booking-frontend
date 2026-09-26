import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { GroupCategory } from "@/lib/researchGroupTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface Props {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: GroupCategory[];
  onChanged: () => void;
}

/** Categories are renamed or deactivated, never deleted, so member and activity history keeps its labels. */
export function ResearchGroupCategories({ groupId, open, onOpenChange, categories, onChanged }: Props) {
  const [items, setItems] = useState<GroupCategory[]>(categories);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setItems(categories);
  }, [open, categories]);

  const run = async <T,>(fn: () => Promise<{ error?: string; data?: T }>, success?: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return null;
    }
    if (success) toast.success(success);
    onChanged();
    return res.data ?? null;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const created = await run(() => apiClient.createResearchGroupCategory(groupId, { name }), "Category added");
    if (created) {
      setItems((prev) => [...prev, created]);
      setNewName("");
    }
  };

  const rename = async () => {
    if (!editing?.name.trim()) return;
    const updated = await run(() => apiClient.updateResearchGroupCategory(groupId, editing.id, { name: editing.name.trim() }));
    if (updated) {
      setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditing(null);
    }
  };

  const toggle = async (category: GroupCategory) => {
    const updated = await run(() => apiClient.updateResearchGroupCategory(groupId, category.id, { active: !category.active }));
    if (updated) setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const move = async (index: number, delta: number) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    const result = await run(() => apiClient.reorderResearchGroupCategories(groupId, next.map((c) => c.id)));
    if (result) setItems(result.results);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
          <DialogDescription>
            Group members by research area or project, e.g. Thin Films, Batteries. Inactive categories stay on past records.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={add} className="flex gap-2">
          <Input value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} placeholder="New category name" aria-label="New category name" />
          <Button type="submit" disabled={busy || !newName.trim()} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" aria-hidden /> Add
          </Button>
        </form>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
            {items.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2 px-2 py-1.5">
                <div className="flex flex-col">
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={busy || i === 0} onClick={() => void move(i, -1)} aria-label={`Move ${c.name} up`}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={busy || i === items.length - 1} onClick={() => void move(i, 1)} aria-label={`Move ${c.name} down`}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {editing?.id === c.id ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <Input
                      value={editing.name}
                      maxLength={120}
                      autoFocus
                      aria-label="Category name"
                      onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void rename();
                        }
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => void rename()} disabled={busy} aria-label="Save name">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel rename">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={`truncate text-sm ${c.active ? "" : "text-muted-foreground line-through"}`}>{c.name}</span>
                    {!c.active ? (
                      <Badge variant="outline" className="text-[10px]">
                        Inactive
                      </Badge>
                    ) : null}
                    <Button type="button" size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={() => setEditing({ id: c.id, name: c.name })} aria-label={`Rename ${c.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <Switch checked={c.active} disabled={busy} onCheckedChange={() => void toggle(c)} aria-label={`${c.active ? "Deactivate" : "Activate"} ${c.name}`} />
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
