import { useEffect, useState } from "react";
import { FlaskConical, Folder, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchWorkspaceOption } from "@/lib/myResearchTypes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyResearchAvailability } from "./useMyResearchAvailability";

const NONE = "__none__";
const NEW = "__new__";

interface Props {
  value: string | null;
  onChange: (workspaceId: string | null) => void;
  className?: string;
  folderLabel?: string | null;
}

/** Optional workspace selector shown on the booking page; renders nothing for users without My Research. */
export function ResearchWorkspacePicker({ value, onChange, className, folderLabel }: Props) {
  const { available, bootstrap } = useMyResearchAvailability();
  const [options, setOptions] = useState<ResearchWorkspaceOption[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    void apiClient.myResearchWorkspaceOptions().then((res) => {
      if (alive) setOptions(res.error || !res.data ? [] : res.data.results);
    });
    return () => {
      alive = false;
    };
  }, [available]);

  if (!available || options == null) return null;
  const canCreate = Boolean(bootstrap?.can_create);
  if (options.length === 0 && !canCreate) return null;

  const create = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await apiClient.createResearchWorkspace({ name: newName.trim() });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not create the workspace.");
      return;
    }
    setOptions((prev) => [...(prev ?? []), { id: res.data!.id, name: res.data!.name, booking_linked: false }]);
    onChange(res.data.id);
    setCreating(false);
    setNewName("");
  };

  return (
    <div
      className={cn(
        "w-full space-y-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/20",
        className,
      )}
    >
      <label className="flex items-center gap-2 text-sm font-medium">
        <FlaskConical className="h-4 w-4 text-violet-600" />
        Research workspace <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Select
        value={creating ? NEW : value ?? NONE}
        onValueChange={(v) => {
          if (v === NEW) {
            setCreating(true);
            return;
          }
          setCreating(false);
          onChange(v === NONE ? null : v);
        }}
      >
        <SelectTrigger className="bg-background sm:max-w-md">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
          {canCreate ? <SelectItem value={NEW}>+ Create workspace…</SelectItem> : null}
        </SelectContent>
      </Select>
      {creating ? (
        <div className="flex gap-2 sm:max-w-md">
          <Input
            value={newName}
            maxLength={200}
            placeholder="Project name"
            className="bg-background"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />
          <Button type="button" size="sm" onClick={create} disabled={saving || !newName.trim()} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </div>
      ) : null}
      {value && folderLabel && !creating ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-violet-800 dark:text-violet-200">
          <Folder className="h-3.5 w-3.5" /> Folder: {folderLabel}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        The booking is added to this private workspace{value && folderLabel ? " and folder" : ""} after it is confirmed. It
        does not change the booking itself.
      </p>
    </div>
  );
}
