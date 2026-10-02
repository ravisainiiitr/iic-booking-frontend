import { Fragment, useEffect, useId, useMemo, useRef, useState, type ComponentType, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, GripVertical, Loader2, RotateCcw, Search, Settings2, Trash2, X } from "lucide-react";
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
import type { DashboardMenuGroup, DashboardMenuLayout } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  EMPTY_DASHBOARD_MENU_LAYOUT,
  addMenuGroup,
  buildMenuTree,
  dedupeMenuEntriesByPath,
  menuNodeKey,
  type DashboardMenuNode,
  type DashboardMenuSection,
  moveGroupItem,
  moveMenuItem,
  moveMenuNode,
  orderMenuIds,
  removeMenuGroup,
  renameMenuGroup,
} from "./dashboardMenuLayout";
import { findActiveMenuId, withMenuItemA11y } from "./menuItemA11y";

export interface DashboardMenuEntry {
  id: string;
  label: string;
  visible: boolean;
  /** Workspace path the entry opens; marks the entry as the current page. */
  path?: string;
  render: () => ReactNode;
}

interface DashboardMenuTreeProps {
  entries: DashboardMenuEntry[];
  defaultOrder: string[];
  layout: DashboardMenuLayout | null;
  canCustomize: boolean;
  /** Path of the open workspace page, if any. */
  activePath?: string | null;
  /** Resolves to an error message, or null when saved. */
  onSaveLayout: (layout: DashboardMenuLayout) => Promise<string | null>;
  /** Rendered after the last menu item (above "Customize menu"). */
  footer?: ReactNode;
  /** Built-in sections (administrator roles): section headings plus a menu search box. */
  sections?: MenuSection[];
}

export type MenuSection = DashboardMenuSection & { icon?: ComponentType<{ className?: string }> };

const COLLAPSED_KEY = "iic-dashboard-menu-collapsed";
export const SECTIONS_OPEN_KEY = "iic-dashboard-menu-sections-open";
const DEFAULT_OPEN_SECTIONS = ["sec_overview", "sec_bookings"];
const MAIN_MENU = "__main__";
const DRAG_TYPE = "text/x-iic-menu-item";

function readIdSet(key: string, fallback: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return new Set(fallback);
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : fallback);
  } catch {
    return new Set(fallback);
  }
}

function writeIdSet(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable */
  }
}

export function DashboardMenuTree({ entries, defaultOrder, layout, canCustomize, activePath, onSaveLayout, footer, sections }: DashboardMenuTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => readIdSet(COLLAPSED_KEY, []));
  const [openSections, setOpenSections] = useState<Set<string>>(() => readIdSet(SECTIONS_OPEN_KEY, DEFAULT_OPEN_SECTIONS));
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);
  const groupIdPrefix = useId();
  const sectioned = Boolean(sections?.length);

  const visibleEntries = useMemo(() => dedupeMenuEntriesByPath(entries.filter((e) => e.visible)), [entries]);
  const byId = useMemo(() => new Map(visibleEntries.map((e) => [e.id, e])), [visibleEntries]);
  const activeId = useMemo(() => findActiveMenuId(visibleEntries, activePath), [visibleEntries, activePath]);
  const renderEntry = (id: string) => {
    const entry = byId.get(id);
    return entry ? withMenuItemA11y(entry.render(), id === activeId) : null;
  };
  const orderedIds = useMemo(
    () => orderMenuIds(visibleEntries.map((e) => e.id), defaultOrder),
    [visibleEntries, defaultOrder],
  );
  const tree = useMemo(() => buildMenuTree(orderedIds, layout, sections), [orderedIds, layout, sections]);

  const activeContainer = useMemo(() => {
    if (!activeId) return null;
    const node = tree.find((n) => n.kind === "group" && n.items.includes(activeId));
    return node && node.kind === "group" ? node : null;
  }, [tree, activeId]);

  useEffect(() => {
    if (!activeContainer) return;
    if (activeContainer.section) {
      const id = activeContainer.section.id;
      setOpenSections((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        writeIdSet(SECTIONS_OPEN_KEY, next);
        return next;
      });
    } else {
      const id = activeContainer.group.id;
      setCollapsed((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        writeIdSet(COLLAPSED_KEY, next);
        return next;
      });
    }
  }, [activeContainer]);

  const toggleGroup = (groupId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      writeIdSet(COLLAPSED_KEY, next);
      return next;
    });
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      writeIdSet(SECTIONS_OPEN_KEY, next);
      return next;
    });
  };

  const containerNameOf = useMemo(() => {
    const names = new Map<string, string>();
    for (const node of tree) {
      if (node.kind === "group") for (const id of node.items) names.set(id, node.group.name);
    }
    return names;
  }, [tree]);
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return [];
    return orderedIds.filter((id) => {
      const label = byId.get(id)?.label.toLowerCase() ?? "";
      const container = containerNameOf.get(id)?.toLowerCase() ?? "";
      return label.includes(needle) || container.includes(needle);
    });
  }, [needle, orderedIds, byId, containerNameOf]);

  const renderSection = (node: Extract<DashboardMenuNode, { kind: "group" }>, section: MenuSection) => {
    const isOpen = openSections.has(section.id);
    const listId = `${groupIdPrefix}-section-${section.id}`;
    const Icon = section.icon;
    const holdsActive = activeId != null && node.items.includes(activeId);
    return (
      <div key={section.id} className="flex flex-col" data-dashboard-menu-section={section.id}>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-[2.6rem] max-sm:text-[0.74rem]",
            holdsActive && "text-primary dark:text-sky-300",
          )}
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          data-menu-keep-open
          onClick={() => toggleSection(section.id)}
        >
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
          <span className="min-w-0 flex-1 truncate">{section.name}</span>
          {!isOpen && (
            <span className="rounded-full bg-muted px-1.5 text-[0.62rem] font-semibold normal-case tabular-nums tracking-normal text-muted-foreground">
              {node.items.length}
              <span className="sr-only"> items</span>
            </span>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !isOpen && "-rotate-90")} aria-hidden />
        </button>
        {isOpen && (
          <div
            id={listId}
            className="dashboard-uniform-cards dashboard-menu-section mb-1 ml-[0.85rem] mt-0.5 flex flex-col border-l border-border/70 pl-1.5"
          >
            {node.items.map((id) => (
              <Fragment key={id}>{renderEntry(id)}</Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {sectioned && (
        <div className="relative" data-menu-keep-open>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            placeholder="Search menu"
            aria-label="Search menu"
            className="h-8 pl-8 pr-8 text-xs [&::-webkit-search-cancel-button]:hidden"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                setQuery("");
              } else if (e.key === "Enter" && matches.length > 0) {
                e.preventDefault();
                resultsRef.current?.querySelector<HTMLElement>('[role="button"]')?.click();
              }
            }}
          />
          {query && (
            <button
              type="button"
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear menu search"
              onClick={() => setQuery("")}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      )}
      {sectioned && needle ? (
        <div ref={resultsRef} className="dashboard-uniform-cards dashboard-menu-section flex flex-col" aria-live="polite">
          {matches.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No menu items match &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            matches.map((id) => <Fragment key={id}>{renderEntry(id)}</Fragment>)
          )}
        </div>
      ) : (
      <div className={cn("dashboard-uniform-cards flex flex-col", sectioned ? "gap-0.5" : "gap-2")}>
        {tree.map((node) => {
          if (node.kind === "item") {
            return <Fragment key={node.id}>{renderEntry(node.id)}</Fragment>;
          }
          if (node.section) return renderSection(node, node.section as MenuSection);
          const isOpen = !collapsed.has(node.group.id);
          const listId = `${groupIdPrefix}-group-${node.group.id}`;
          return (
            <div key={`group-${node.group.id}`} className="flex flex-col gap-[0.3rem]" data-dashboard-menu-group>
              {/* Sized like the compact nav rows in index.css (.dashboard-menu-nav .dashboard-uniform-cards > .cursor-pointer). */}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[0.45rem] border border-border/85 bg-card px-[0.55rem] py-[0.4rem] text-left text-card-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-[2.75rem] max-sm:px-[0.7rem] max-sm:py-[0.65rem]"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listId : undefined}
                data-menu-keep-open
                onClick={() => toggleGroup(node.group.id)}
              >
                <span className="flex h-[1.65rem] w-[1.65rem] shrink-0 items-center justify-center rounded-[0.4rem] bg-gradient-to-br from-slate-500 to-slate-700 text-white max-sm:h-8 max-sm:w-8">
                  {isOpen ? (
                    <FolderOpen className="h-[0.85rem] w-[0.85rem] max-sm:h-4 max-sm:w-4" aria-hidden />
                  ) : (
                    <Folder className="h-[0.85rem] w-[0.85rem] max-sm:h-4 max-sm:w-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.78rem] font-semibold leading-[1.15rem] tracking-[-0.01em] max-sm:text-[0.9rem] max-sm:leading-5">
                  {node.group.name}
                </span>
                <span className="rounded-full bg-muted px-1.5 text-[0.65rem] font-semibold text-muted-foreground">
                  {node.items.length}
                  <span className="sr-only"> items</span>
                </span>
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </button>
              {isOpen && (
                <div id={listId} className="dashboard-uniform-cards ml-2 flex flex-col gap-2 border-l-2 border-primary/20 pl-2">
                  {node.items.map((id) => (
                    <Fragment key={id}>{renderEntry(id)}</Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
      {footer}
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
          sections={sections}
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
  sections?: MenuSection[];
}

function DashboardMenuEditor({ open, onOpenChange, orderedIds, labels, layout, onSave, sections }: DashboardMenuEditorProps) {
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
  const draftTree = useMemo(() => buildMenuTree(orderedIds, draft, sections), [orderedIds, draft, sections]);
  const mainMenuLabel = sections?.length ? "Default section" : "Main menu";
  const emptyGroups = useMemo(() => {
    const shown = new Set(draftTree.flatMap((n) => (n.kind === "group" ? [n.group.id] : [])));
    return draft.groups.filter((g) => !shown.has(g.id));
  }, [draftTree, draft.groups]);

  const move = (itemId: string, target: string, beforeId?: string) => {
    setDraft((d) => moveMenuItem(d, itemId, target === MAIN_MENU ? null : target, beforeId));
  };

  const moveTop = (key: string, delta: -1 | 1) => {
    setDraft((d) => moveMenuNode(d, buildMenuTree(orderedIds, d, sections).map(menuNodeKey), key, delta));
  };

  const moveInSection = (sectionId: string, itemId: string, delta: -1 | 1) => {
    setDraft((d) => {
      const node = buildMenuTree(orderedIds, d, sections).find((n) => n.kind === "group" && n.section?.id === sectionId);
      return node && node.kind === "group" ? moveMenuNode(d, node.items, itemId, delta) : d;
    });
  };

  const priorityControls = (position: number, count: number, label: string, onMove: (delta: -1 | 1) => void) => (
    <div className="flex shrink-0 items-center gap-0.5">
      <span
        className="min-w-[1.6rem] rounded bg-muted px-1 text-center text-xs font-semibold tabular-nums text-muted-foreground"
        title="Priority (1 = top of the menu)"
      >
        {position + 1}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label={`Move ${label} up`}
        title="Move up"
        disabled={position === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label={`Move ${label} down`}
        title="Move down"
        disabled={position >= count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );

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

  const renderItem = (id: string, container: string, controls?: ReactNode) => (
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
      {controls}
      <Select value={container} onValueChange={(target) => move(id, target)}>
        <SelectTrigger className="h-7 w-[9.5rem] shrink-0 text-xs" aria-label={`Move ${labels.get(id)?.label ?? id} to`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={MAIN_MENU}>{mainMenuLabel}</SelectItem>
          {draft.groups.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name || "Untitled menu"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const renderGroup = (g: DashboardMenuGroup, items: string[], controls?: ReactNode) => (
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
        {controls}
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
          items.map((id, index) =>
            renderItem(
              id,
              g.id,
              priorityControls(index, items.length, labels.get(id)?.label ?? id, (delta) =>
                setDraft((d) => moveGroupItem(d, g.id, id, delta, visible)),
              ),
            ),
          )
        )}
      </div>
    </div>
  );

  const renderSectionBlock = (node: Extract<DashboardMenuNode, { kind: "group" }>, section: DashboardMenuSection, controls: ReactNode) => (
    <div
      key={section.id}
      {...dropProps(MAIN_MENU)}
      className="rounded-lg border bg-muted/30 p-2"
      data-editor-section={section.id}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{section.name}</span>
        <span className="hidden text-[0.7rem] text-muted-foreground sm:inline">Built-in section</span>
        {controls}
      </div>
      <div className="ml-3 space-y-1 border-l-2 border-border pl-3">
        {node.items.map((id, index) =>
          renderItem(
            id,
            MAIN_MENU,
            priorityControls(index, node.items.length, labels.get(id)?.label ?? id, (delta) => moveInSection(section.id, id, delta)),
          ),
        )}
      </div>
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
    const groupKeys = new Set(draft.groups.map((g) => `group:${g.id}`));
    const cleaned: DashboardMenuLayout = {
      groups: draft.groups.map((g) => ({ ...g, name: g.name.trim() })),
      order: (draft.order ?? []).filter((k) => !k.startsWith("group:") || groupKeys.has(k)),
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
            Set the priority of each entry with the up and down arrows (1 is shown at the top). You can also create
            your own menus and drag items into them (or use &ldquo;Move to&rdquo;).
            {sections?.length
              ? " Items you do not move into your own menu stay in their built-in section; you can reorder sections and the items inside them."
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={newName}
            maxLength={60}
            placeholder="New menu name, e.g. Daily work"
            aria-label="New menu name"
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
          {emptyGroups.map((g) => renderGroup(g, []))}

          <div
            {...dropProps(MAIN_MENU)}
            className={cn("rounded-lg border p-2", dropTarget === MAIN_MENU && "border-primary bg-primary/5")}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Main menu (top to bottom priority)
            </p>
            <div className="space-y-1">
              {draftTree.map((node, index) => {
                const key = menuNodeKey(node);
                const label = node.kind === "item" ? labels.get(node.id)?.label ?? node.id : node.group.name;
                const controls = priorityControls(index, draftTree.length, label, (delta) => moveTop(key, delta));
                if (node.kind === "item") return renderItem(node.id, MAIN_MENU, controls);
                if (node.section) return renderSectionBlock(node, node.section, controls);
                return renderGroup(node.group, node.items, controls);
              })}
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setDraft(EMPTY_DASHBOARD_MENU_LAYOUT)}
            disabled={saving || (draft.groups.length === 0 && !draft.order?.length)}
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
