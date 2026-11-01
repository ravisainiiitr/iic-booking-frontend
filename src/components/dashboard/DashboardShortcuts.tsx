import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  BookOpen,
  Bookmark,
  CalendarDays,
  ChevronDown,
  FlaskConical,
  Folder,
  LineChart,
  Loader2,
  Plus,
  Settings2,
  SlidersHorizontal,
  Star,
  Trash2,
  Users,
  Wallet,
  X,
  FileText,
} from "lucide-react";

import { apiClient, type DashboardShortcutGroup } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ShortcutEntry = { id: string; label: string; path: string };

const ICONS: Record<string, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  star: { label: "Star", Icon: Star },
  flask: { label: "Lab", Icon: FlaskConical },
  calendar: { label: "Calendar", Icon: CalendarDays },
  wallet: { label: "Wallet", Icon: Wallet },
  file: { label: "Document", Icon: FileText },
  chart: { label: "Chart", Icon: LineChart },
  users: { label: "People", Icon: Users },
  bookmark: { label: "Bookmark", Icon: Bookmark },
  settings: { label: "Settings", Icon: Settings2 },
  bell: { label: "Bell", Icon: Bell },
  book: { label: "Book", Icon: BookOpen },
  folder: { label: "Folder", Icon: Folder },
};

function GroupIcon({ icon, className }: { icon: string; className?: string }) {
  const { Icon } = ICONS[icon] ?? ICONS.star;
  return <Icon className={className} aria-hidden />;
}

const newId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function move<T>(list: T[], index: number, by: number): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/**
 * Main content area of internal and external users' dashboards: the user's own groups of dashboard buttons. Only
 * buttons the user already has (``entries``) are shown or offered, so grouping never changes what they can open;
 * the dashboard menu keeps every button, grouped or not.
 */
export default function DashboardShortcuts({
  entries,
  onOpen,
}: {
  entries: ShortcutEntry[];
  onOpen: (path: string, label: string) => void;
}) {
  const [groups, setGroups] = useState<DashboardShortcutGroup[] | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getDashboardShortcuts()
      .then((res) => {
        if (!cancelled) setGroups(res.data?.groups ?? []);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (next: DashboardShortcutGroup[]) => {
    const res = await apiClient.saveDashboardShortcuts(next);
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    setGroups(res.data?.groups ?? next);
    return true;
  };

  const toggle = (id: string) => {
    if (!groups) return;
    const next = groups.map((g) => (g.id === id ? { ...g, collapsed: !g.collapsed } : g));
    setGroups(next);
    void apiClient.saveDashboardShortcuts(next);
  };

  if (groups === null) return null;
  const visibleGroups = groups.map((g) => ({ ...g, items: g.items.filter((id) => byId.has(id)) }));

  return (
    <section aria-labelledby="my-shortcuts-title" className="mb-4 space-y-3" data-testid="dashboard-shortcuts">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="my-shortcuts-title" className="text-base font-semibold tracking-tight">My shortcuts</h2>
          <p className="text-xs text-muted-foreground">Your own groups of the dashboard buttons you use most.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditorOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {groups.length ? "Customize" : "Create a group"}
        </Button>
      </div>

      {visibleGroups.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.map((g) => {
            const bodyId = `shortcut-group-${g.id}`;
            return (
              <div key={g.id} className="rounded-xl border border-border/70 bg-card shadow-sm" data-testid="shortcut-group">
                <button
                  type="button"
                  onClick={() => toggle(g.id)}
                  aria-expanded={!g.collapsed}
                  aria-controls={bodyId}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-sky-300">
                    <GroupIcon icon={g.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{g.items.length}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !g.collapsed && "rotate-180")} aria-hidden />
                </button>
                <div id={bodyId} hidden={g.collapsed} className="border-t border-border/60 p-2.5">
                  {g.items.length ? (
                    <ul className="flex flex-wrap gap-2">
                      {g.items.map((id) => {
                        const e = byId.get(id)!;
                        return (
                          <li key={id}>
                            <Button size="sm" variant="secondary" className="h-auto min-h-9 whitespace-normal text-left" onClick={() => onOpen(e.path, e.label)}>
                              {e.label}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="px-1 text-xs text-muted-foreground">No buttons yet: add some with Customize.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <ShortcutEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        groups={groups}
        entries={entries}
        onSave={async (next) => {
          if (await persist(next)) {
            toast.success("Shortcuts saved.");
            setEditorOpen(false);
          }
        }}
        onRestore={async () => {
          const res = await apiClient.resetDashboardShortcuts();
          if (res.error) {
            toast.error(res.error);
            return;
          }
          setGroups([]);
          setEditorOpen(false);
          toast.success("Default dashboard restored.");
        }}
      />
    </section>
  );
}

function ShortcutEditor({
  open,
  onOpenChange,
  groups,
  entries,
  onSave,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: DashboardShortcutGroup[];
  entries: ShortcutEntry[];
  onSave: (groups: DashboardShortcutGroup[]) => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<DashboardShortcutGroup[]>(groups);
  const [saving, setSaving] = useState(false);
  const labels = useMemo(() => new Map(entries.map((e) => [e.id, e.label])), [entries]);

  useEffect(() => {
    if (open) setDraft(groups.map((g) => ({ ...g, items: g.items.filter((id) => labels.has(id)) })));
  }, [open, groups, labels]);

  const used = new Set(draft.flatMap((g) => g.items));
  const free = entries.filter((e) => !used.has(e.id));
  const update = (index: number, change: Partial<DashboardShortcutGroup>) =>
    setDraft((d) => d.map((g, i) => (i === index ? { ...g, ...change } : g)));
  const invalid = draft.some((g) => !g.name.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize my shortcuts</DialogTitle>
          <DialogDescription>
            Make groups of the dashboard buttons you use most. Every button stays in the dashboard menu as well.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {draft.map((g, gi) => (
            <li key={g.id} className="rounded-lg border p-3" data-testid="shortcut-editor-group">
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid min-w-[10rem] flex-1 gap-1">
                  <Label htmlFor={`sg-name-${g.id}`}>Group name</Label>
                  <Input id={`sg-name-${g.id}`} value={g.name} maxLength={40} onChange={(e) => update(gi, { name: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`sg-icon-${g.id}`}>Icon</Label>
                  <select
                    id={`sg-icon-${g.id}`}
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                    value={g.icon}
                    onChange={(e) => update(gi, { icon: e.target.value })}
                  >
                    {Object.entries(ICONS).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" aria-label={`Move ${g.name || "group"} up`} disabled={gi === 0} onClick={() => setDraft((d) => move(d, gi, -1))}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Move ${g.name || "group"} down`} disabled={gi === draft.length - 1} onClick={() => setDraft((d) => move(d, gi, 1))}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${g.name || "group"}`} onClick={() => setDraft((d) => d.filter((_, i) => i !== gi))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <ul className="mt-2 space-y-1">
                {g.items.map((id, ii) => (
                  <li key={id} className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-sm">
                    <span className="min-w-0 flex-1 truncate">{labels.get(id)}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Move ${labels.get(id)} up`} disabled={ii === 0} onClick={() => update(gi, { items: move(g.items, ii, -1) })}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Move ${labels.get(id)} down`} disabled={ii === g.items.length - 1} onClick={() => update(gi, { items: move(g.items, ii, 1) })}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove ${labels.get(id)} from ${g.name || "group"}`} onClick={() => update(gi, { items: g.items.filter((x) => x !== id) })}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
              {free.length ? (
                <div className="mt-2 grid gap-1">
                  <Label htmlFor={`sg-add-${g.id}`} className="text-xs text-muted-foreground">Add a button</Label>
                  <select
                    id={`sg-add-${g.id}`}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value=""
                    onChange={(e) => e.target.value && update(gi, { items: [...g.items, e.target.value] })}
                  >
                    <option value="">Choose a button…</option>
                    {free.map((e) => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-1.5"
          disabled={draft.length >= 12}
          onClick={() => setDraft((d) => [...d, { id: newId(), name: "New group", icon: "star", items: [], collapsed: false }])}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add a group
        </Button>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (window.confirm("Remove all your groups and go back to the default dashboard?")) void onRestore();
            }}
          >
            Restore default
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={saving || invalid}
              onClick={async () => {
                setSaving(true);
                await onSave(draft.map((g) => ({ ...g, name: g.name.trim() })));
                setSaving(false);
              }}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
