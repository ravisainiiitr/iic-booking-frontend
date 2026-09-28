import { Fragment, useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, GripVertical, Loader2, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardMenuLayout } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  EMPTY_DASHBOARD_MENU_LAYOUT,
  addMenuGroup,
  buildMenuTree,
  moveMenuItem,
  orderMenuIds,
  removeMenuGroup,
  renameMenuGroup,
} from "./dashboardMenuLayout";

export interface DashboardMenuEntry {
  id: string;
  label: string;
  visible: boolean;
  render: () => ReactNode;
}

interface DashboardMenuTreeProps {
  entries: DashboardMenuEntry[];
  defaultOrder: string[];
  layout: DashboardMenuLayout | null;
  canCustomize: boolean;
  /** Resolves to an error message, or null when saved. */
  onSaveLayout: (layout: DashboardMenuLayout) => Promise<string | null>;
}

const COLLAPSED_KEY = "iic-dashboard-menu-collapsed";
const MAIN_MENU = "__main__";
const DRAG_TYPE = "text/x-iic-menu-item";

function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function DashboardMenuTree({ entries, defaultOrder, layout, canCustomize, onSaveLayout }: DashboardMenuTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed);
  const [editorOpen, setEditorOpen] = useState(false);

  const visibleEntries = useMemo(() => entries.filter((e) => e.visible), [entries]);
  const byId = useMemo(() => new Map(visibleEntries.map((e) => [e.id, e])), [visibleEntries]);
  const orderedIds = useMemo(
    () => orderMenuIds(visibleEntries.map((e) => e.id), defaultOrder),
    [visibleEntries, defaultOrder],
  );
  const tree = useMemo(() => buildMenuTree(orderedIds, layout), [orderedIds, layout]);

  const toggleGroup = (groupId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  return (
    <>
      <div className="dashboard-uniform-cards flex flex-col gap-2">
        {tree.map((node) => {
          if (node.kind === "item") {
            return <Fragment key={node.id}>{byId.get(node.id)?.render()}</Fragment>;
          }
          const isOpen = !collapsed.has(node.group.id);
          return (
            <div key={`group-${node.group.id}`} className="flex flex-col gap-1" data-dashboard-menu-group>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-2 py-1.5 text-left text-[0.78rem] font-semibold text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={isOpen}
                data-menu-keep-open
                onClick={() => toggleGroup(node.group.id)}
              >
                {isOpen ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Folder className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate">{node.group.name}</span>
                <span className="rounded-full bg-primary/15 px-1.5 text-[0.65rem] font-semibold text-primary">
                  {node.items.length}
                </span>
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </button>
              {isOpen && (
                <div className="dashboard-uniform-cards ml-2 flex flex-col gap-2 border-l-2 border-primary/20 pl-2">
                  {node.items.map((id) => (
                    <Fragment key={id}>{byId.get(id)?.render()}</Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {canCustomize && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
          data-menu-keep-open
          onClick={() => setEditorOpen(true)}
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          Customize menu
        </Button>
      )}
      {canCustomize && (
        <DashboardMenuEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          orderedIds={orderedIds}
          labels={byId}
          layout={layout ?? EMPTY_DASHBOARD_MENU_LAYOUT}
          onSave={onSaveLayout}
        />
      )}
    </>
  );
}

interface DashboardMenuEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderedIds: string[];
  labels: Map<string, DashboardMenuEntry>;
  layout: DashboardMenuLayout;
  onSave: (layout: DashboardMenuLayout) => Promise<string | null>;
}

function DashboardMenuEditor({ open, onOpenChange, orderedIds, labels, layout, onSave }: DashboardMenuEditorProps) {
  const [draft, setDraft] = useState<DashboardMenuLayout>(layout);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(layout);
      setNewName("");
      setError(null);
    }
  }, [open, layout]);

  const visible = useMemo(() => new Set(orderedIds), [orderedIds]);
  const grouped = useMemo(() => {
    const ids = new Set<string>();
    for (const g of draft.groups) for (const i of g.items) if (visible.has(i)) ids.add(i);
    return ids;
  }, [draft, visible]);
  const mainItems = orderedIds.filter((id) => !grouped.has(id));

  const move = (itemId: string, target: string, beforeId?: string) => {
    setDraft((d) => moveMenuItem(d, itemId, target === MAIN_MENU ? null : target, beforeId));
  };

  const dropProps = (target: string, beforeId?: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(beforeId ? `${target}:${beforeId}` : target);
    },
    onDragLeave: () => setDropTarget(null),
    onDrop: (e: DragEvent) => {
      const itemId = e.dataTransfer.getData(DRAG_TYPE);
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      if (itemId) move(itemId, target, beforeId);
    },
  });

  const renderItem = (id: string, container: string) => (
    <div
      key={id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, id);
        e.dataTransfer.effectAllowed = "move";
      }}
      {...(container === MAIN_MENU ? {} : dropProps(container, id))}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-sm",
        dropTarget === `${container}:${id}` && "border-t-2 border-t-primary",
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{labels.get(id)?.label ?? id}</span>
      <Select value={container} onValueChange={(target) => move(id, target)}>
        <SelectTrigger className="h-7 w-[9.5rem] shrink-0 text-xs" aria-label={`Move ${labels.get(id)?.label ?? id} to`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={MAIN_MENU}>Main menu</SelectItem>
          {draft.groups.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name || "Untitled menu"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const addGroup = () => {
    if (!newName.trim()) return;
    setDraft((d) => addMenuGroup(d, newName));
    setNewName("");
  };

  const save = async () => {
    if (draft.groups.some((g) => !g.name.trim())) {
      setError("Every menu needs a name.");
      return;
    }
    setSaving(true);
    setError(null);
    const cleaned: DashboardMenuLayout = {
      groups: draft.groups.map((g) => ({ ...g, name: g.name.trim() })),
    };
    const err = await onSave(cleaned);
    setSaving(false);
    if (err) setError(err);
    else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-menu-keep-open>
        <DialogHeader>
          <DialogTitle>Customize dashboard menu</DialogTitle>
          <DialogDescription>
            Create your own menus, then drag items into them (or use &ldquo;Move to&rdquo;). Moving an item back to
            the main menu returns it to its original place.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={newName}
            maxLength={60}
            placeholder="New menu name, e.g. Daily work"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGroup();
              }
            }}
          />
          <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={addGroup} disabled={!newName.trim()}>
            <FolderPlus className="h-4 w-4" aria-hidden />
            Add menu
          </Button>
        </div>

        <div className="space-y-3">
          {draft.groups.map((g) => {
            const items = g.items.filter((i) => visible.has(i));
            return (
              <div
                key={g.id}
                {...dropProps(g.id)}
                className={cn(
                  "rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-2",
                  dropTarget === g.id && "border-primary bg-primary/10",
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <Input
                    value={g.name}
                    maxLength={60}
                    className="h-8 text-sm font-semibold"
                    aria-label="Menu name"
                    onChange={(e) => setDraft((d) => renameMenuGroup(d, g.id, e.target.value))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive"
                    aria-label={`Remove menu ${g.name}`}
                    title="Remove menu (items go back to the main menu)"
                    onClick={() => setDraft((d) => removeMenuGroup(d, g.id))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                <div className="ml-3 space-y-1 border-l-2 border-primary/20 pl-3">
                  {items.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">Drop menu items here.</p>
                  ) : (
                    items.map((id) => renderItem(id, g.id))
                  )}
                </div>
              </div>
            );
          })}

          <div
            {...dropProps(MAIN_MENU)}
            className={cn("rounded-lg border p-2", dropTarget === MAIN_MENU && "border-primary bg-primary/5")}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Main menu</p>
            <div className="space-y-1">{mainItems.map((id) => renderItem(id, MAIN_MENU))}</div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setDraft(EMPTY_DASHBOARD_MENU_LAYOUT)}
            disabled={saving || draft.groups.length === 0}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Save menu
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DashboardMenuTree;
