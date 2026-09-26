import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Home, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { ResearchFolder } from "@/lib/myResearchTypes";
import { cn } from "@/lib/utils";

interface NodeProps {
  workspaceId: string;
  folder: ResearchFolder;
  depth: number;
  selectedId: string | null;
  expandPath: string[];
  disabledIds?: Set<string>;
  refreshKey: number;
  onSelect: (folder: ResearchFolder) => void;
}

function useChildren(workspaceId: string, parentId: string | null, load: boolean, refreshKey: number) {
  const [children, setChildren] = useState<ResearchFolder[] | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!load) return;
    let alive = true;
    setLoading(true);
    void apiClient.listResearchFolders(workspaceId, parentId).then((res) => {
      if (!alive) return;
      setLoading(false);
      setChildren(res.data && !res.error ? res.data.results : []);
    });
    return () => {
      alive = false;
    };
  }, [workspaceId, parentId, load, refreshKey]);
  return { children, loading };
}

function FolderNode({ workspaceId, folder, depth, selectedId, expandPath, disabledIds, refreshKey, onSelect }: NodeProps) {
  const [open, setOpen] = useState(expandPath.includes(folder.id));
  const { children, loading } = useChildren(workspaceId, folder.id, open && folder.has_children, refreshKey);
  const disabled = disabledIds?.has(folder.id) ?? false;

  useEffect(() => {
    if (expandPath.includes(folder.id)) setOpen(true);
  }, [expandPath, folder.id]);

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md py-1 pr-2 text-sm",
          selectedId === folder.id ? "bg-violet-100 font-medium text-violet-900 dark:bg-violet-900/40 dark:text-violet-100" : "hover:bg-muted",
          disabled && "pointer-events-none opacity-40",
        )}
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/10"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Collapse" : "Expand"}
          disabled={!folder.has_children}
        >
          {folder.has_children ? open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" /> : null}
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => onSelect(folder)}>
          {selectedId === folder.id ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-violet-600" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-violet-500/80" />
          )}
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {open && folder.has_children ? (
        loading && !children ? (
          <Loader2 className="my-1 h-3.5 w-3.5 animate-spin text-muted-foreground" style={{ marginLeft: depth * 14 + 26 }} />
        ) : (
          <ul>
            {(children ?? []).map((child) => (
              <FolderNode
                key={child.id}
                workspaceId={workspaceId}
                folder={child}
                depth={depth + 1}
                selectedId={selectedId}
                expandPath={expandPath}
                disabledIds={disabledIds}
                refreshKey={refreshKey}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )
      ) : null}
    </li>
  );
}

interface TreeProps {
  workspaceId: string;
  selectedId: string | null;
  expandPath?: string[];
  disabledIds?: Set<string>;
  refreshKey?: number;
  rootLabel?: string;
  onSelect: (folder: ResearchFolder | null) => void;
}

export function FolderTree({
  workspaceId,
  selectedId,
  expandPath = [],
  disabledIds,
  refreshKey = 0,
  rootLabel = "All files",
  onSelect,
}: TreeProps) {
  const { children, loading } = useChildren(workspaceId, null, true, refreshKey);
  const select = useCallback((folder: ResearchFolder) => onSelect(folder), [onSelect]);
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm",
          selectedId === null ? "bg-violet-100 font-medium text-violet-900 dark:bg-violet-900/40 dark:text-violet-100" : "hover:bg-muted",
        )}
      >
        <Home className="h-4 w-4 text-violet-600" />
        {rootLabel}
      </button>
      {loading && !children ? (
        <Loader2 className="ml-4 h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <ul>
          {(children ?? []).map((folder) => (
            <FolderNode
              key={folder.id}
              workspaceId={workspaceId}
              folder={folder}
              depth={1}
              selectedId={selectedId}
              expandPath={expandPath}
              disabledIds={disabledIds}
              refreshKey={refreshKey}
              onSelect={select}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
