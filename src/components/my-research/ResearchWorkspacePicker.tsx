import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical, Folder, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { ResearchWorkspaceOption } from "@/lib/myResearchTypes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTip } from "@/components/booking/InfoTip";
import { useSessionExpanded } from "@/components/booking/PeakCollapsible";
import { useMyResearchAvailability } from "./useMyResearchAvailability";

const NONE = "__none__";
const NEW = "__new__";

interface Props {
  value: string | null;
  onChange: (workspaceId: string | null) => void;
  className?: string;
  folderLabel?: string | null;
  /** Preselect the project this user picked last time (stored per user in this browser). */
  rememberLast?: boolean;
  /**
   * Start as a one-line "Project (optional): None ▸ Add to project" row (peak booking window).
   * The user's expand/collapse choice is remembered for the browser session.
   */
  collapsible?: boolean;
}

function readLast(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLast(key: string, id: string | null) {
  try {
    if (id) window.localStorage.setItem(key, id);
    else window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable (private mode); remembering is best-effort */
  }
}

/** Optional project selector shown on the booking page; renders nothing for users without My Research. */
export function ResearchWorkspacePicker({
  value,
  onChange,
  className,
  folderLabel,
  rememberLast = false,
  collapsible = false,
}: Props) {
  const { available, bootstrap } = useMyResearchAvailability();
  const { user } = useAuth();
  const [options, setOptions] = useState<ResearchWorkspaceOption[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [expanded, setExpanded] = useSessionExpanded("projectPicker", false);
  const defaultApplied = useRef(false);
  const triggerId = useId();
  const storageKey = rememberLast && user ? `iic.myResearch.lastProject.${user.id}` : null;

  useEffect(() => {
    if (!available) return;
    let alive = true;
    void apiClient.myResearchWorkspaceOptions().then((res) => {
      if (!alive) return;
      const ok = !res.error && Boolean(res.data);
      setOptions(ok ? res.data!.results : []);
      setOptionsLoaded(ok);
    });
    return () => {
      alive = false;
    };
  }, [available]);

  // e.g. a booking template pointing at a project that was deleted or is no longer shared with the user.
  useEffect(() => {
    if (optionsLoaded && options && value && !options.some((o) => o.id === value)) onChange(null);
  }, [optionsLoaded, options, value, onChange]);

  useEffect(() => {
    if (!storageKey || defaultApplied.current || !optionsLoaded || !options) return;
    defaultApplied.current = true;
    if (value) return;
    const last = readLast(storageKey);
    if (last && options.some((o) => o.id === last)) onChange(last);
  }, [storageKey, optionsLoaded, options, value, onChange]);

  if (!available || options == null) return null;
  const canCreate = Boolean(bootstrap?.can_create);
  if (options.length === 0 && !canCreate) return null;

  const select = (id: string | null) => {
    onChange(id);
    if (storageKey) writeLast(storageKey, id);
  };

  const create = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await apiClient.createResearchWorkspace({ name: newName.trim() });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not create the project.");
      return;
    }
    setOptions((prev) => [...(prev ?? []), { id: res.data!.id, name: res.data!.name, booking_linked: false }]);
    select(res.data.id);
    setCreating(false);
    setNewName("");
  };

  const helper = `The booking is added to this private project${
    value && folderLabel ? " and folder" : ""
  } after it is confirmed. It does not change the booking itself.`;
  const selectedName = value ? options.find((o) => o.id === value)?.name ?? "Selected project" : "None";

  if (collapsible && !expanded && !creating) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => setExpanded(true)}
        data-testid="project-picker-collapsed"
        className={cn(
          "flex w-full min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-1.5 text-left text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <FlaskConical className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="shrink-0 font-medium">
          Project <span className="font-normal text-muted-foreground">(optional)</span>:
        </span>
        <span className="min-w-0 truncate">{selectedName}</span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary">
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          {value ? "Change" : "Add to project"}
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn("w-full space-y-2 rounded-lg border bg-muted/30 px-3 py-2", className)}
      data-testid="project-picker"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {collapsible ? (
          <button
            type="button"
            aria-expanded
            aria-label="Hide project picker"
            onClick={() => setExpanded(false)}
            className="-ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <label htmlFor={triggerId} className="flex items-center gap-2 text-sm font-medium">
          <FlaskConical className="h-4 w-4 text-primary" aria-hidden />
          Project <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Select
          value={creating ? NEW : value ?? NONE}
          onValueChange={(v) => {
            if (v === NEW) {
              setCreating(true);
              return;
            }
            setCreating(false);
            select(v === NONE ? null : v);
          }}
        >
          <SelectTrigger id={triggerId} className="h-9 min-w-0 flex-1 bg-background sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
            {canCreate ? <SelectItem value={NEW}>+ New project…</SelectItem> : null}
          </SelectContent>
        </Select>
        <InfoTip label="About adding the booking to a project">{helper}</InfoTip>
        {value && folderLabel && !creating ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary dark:text-sky-200">
            <Folder className="h-3.5 w-3.5" aria-hidden /> Folder: {folderLabel}
          </span>
        ) : null}
      </div>
      {creating ? (
        <div className="flex gap-2 sm:max-w-md">
          <Input
            value={newName}
            maxLength={200}
            placeholder="Project name"
            aria-label="New project name"
            className="h-9 bg-background"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />
          <Button type="button" size="sm" onClick={create} disabled={saving || !newName.trim()} className="h-9 gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </div>
      ) : null}
    </div>
  );
}
