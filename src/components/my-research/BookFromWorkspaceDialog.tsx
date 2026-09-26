import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, Folder, Loader2, Microscope, Search } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type EquipmentHit = {
  equipment_id: number;
  code: string;
  name: string;
  status_display: string;
  internal_department_name?: string | null;
};

interface Props {
  workspaceId: string;
  folderId: string | null;
  folderLabel: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Picks equipment, then opens the booking page with this workspace/folder preselected for auto-linking. */
export function BookFromWorkspaceDialog({ workspaceId, folderId, folderLabel, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EquipmentHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await apiClient.getEquipments(query.trim() || undefined);
      if (!alive) return;
      setLoading(false);
      setResults(res.error || !res.data ? [] : res.data.equipments.slice(0, 40));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  const choose = (eq: EquipmentHit) => {
    const back = new URLSearchParams({ tab: folderId ? "files" : "bookings" });
    if (folderId) back.set("folder", folderId);
    const params = new URLSearchParams({
      equipment_id: String(eq.equipment_id),
      research_workspace: workspaceId,
      research_return: `/my-research/${workspaceId}?${back.toString()}`,
    });
    if (folderId) params.set("research_folder", folderId);
    if (folderLabel) params.set("research_folder_name", folderLabel);
    onOpenChange(false);
    navigate(`/book-equipment?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-violet-600" /> Book equipment
          </DialogTitle>
          <DialogDescription>
            The new booking is added to this workspace automatically
            {folderLabel ? " and filed in the folder below" : ""} once it is confirmed.
          </DialogDescription>
        </DialogHeader>
        {folderLabel ? (
          <div className="flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50/60 px-3 py-2 text-sm dark:border-violet-900/50 dark:bg-violet-950/20">
            <Folder className="h-4 w-4 shrink-0 text-violet-600" />
            <span className="truncate">{folderLabel}</span>
          </div>
        ) : null}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search equipment by name or code"
            className="pl-9"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          {loading && results.length === 0 ? (
            <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
          ) : results.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No equipment found.</p>
          ) : (
            <ul className="divide-y">
              {results.map((eq) => (
                <li key={eq.equipment_id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted"
                    onClick={() => choose(eq)}
                  >
                    <Microscope className="h-4 w-4 shrink-0 text-violet-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{eq.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {eq.code}
                        {eq.internal_department_name ? ` · ${eq.internal_department_name}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{eq.status_display}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
