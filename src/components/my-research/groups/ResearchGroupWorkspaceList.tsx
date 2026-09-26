import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FlaskConical, Link2, Loader2, Lock, Unlink } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchPublication } from "@/lib/myResearchTypes";
import type { GroupLinkedWorkspace } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyHint } from "./groupUi";

interface Props {
  groupId: string;
  canManage: boolean;
}

type PickerKind = "workspaces" | "publications" | null;

/** Group-level associations only. A linked workspace is still opened through its own sharing permissions. */
export function ResearchGroupWorkspaceList({ groupId, canManage }: Props) {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<GroupLinkedWorkspace[]>([]);
  const [publications, setPublications] = useState<ResearchPublication[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [options, setOptions] = useState<Array<{ id: string; label: string; sub: string; disabled?: boolean }>>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ws, pubs] = await Promise.all([
      apiClient.listResearchGroupWorkspaces(groupId),
      apiClient.listResearchGroupPublications(groupId),
    ]);
    setLoading(false);
    setWorkspaces(ws.data?.results ?? []);
    setPublications(pubs.data?.results ?? []);
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPicker = async (kind: Exclude<PickerKind, null>) => {
    setPicker(kind);
    setChosen([]);
    setOptions([]);
    if (kind === "workspaces") {
      const res = await apiClient.listLinkableGroupWorkspaces(groupId);
      setOptions(
        (res.data?.results ?? []).map((w) => ({
          id: w.id,
          label: w.name,
          sub: w.owner ? `Owner: ${w.owner.name}` : "",
          disabled: w.linked,
        })),
      );
    } else {
      const res = await apiClient.listLinkableGroupPublications(groupId);
      setOptions(
        (res.data?.results ?? []).map((p) => ({
          id: String(p.claim_id),
          label: p.title,
          sub: [p.journal, p.year, p.status_display].filter(Boolean).join(" · "),
        })),
      );
    }
  };

  const link = async () => {
    if (!picker || chosen.length === 0) return;
    setBusy(true);
    const res =
      picker === "workspaces"
        ? await apiClient.linkResearchGroupWorkspaces(groupId, chosen)
        : await apiClient.linkResearchGroupPublications(groupId, chosen.map(Number));
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Linked to the group");
    setPicker(null);
    void load();
  };

  const unlinkWorkspace = async (w: GroupLinkedWorkspace) => {
    const res = await apiClient.unlinkResearchGroupWorkspace(groupId, w.id);
    if (res.error) toast.error(res.error);
    else void load();
  };

  const unlinkPublication = async (p: ResearchPublication) => {
    const res = await apiClient.unlinkResearchGroupPublication(groupId, p.claim_id);
    if (res.error) toast.error(res.error);
    else void load();
  };

  if (loading && workspaces.length === 0 && publications.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Linking a workspace to the group does not share it. Members can open a workspace only if its owner has shared it with
        them from the workspace itself.
      </p>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="h-4 w-4 text-violet-600" aria-hidden /> Linked workspaces ({workspaces.length})
          </h3>
          {canManage ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void openPicker("workspaces")}>
              <Link2 className="h-4 w-4" aria-hidden /> Link workspace
            </Button>
          ) : null}
        </div>
        {workspaces.length === 0 ? (
          <EmptyHint>No workspaces linked to this group.</EmptyHint>
        ) : (
          <ul className="divide-y rounded-lg border">
            {workspaces.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{w.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {w.owner ? `Owner: ${w.owner.name}` : ""}
                    {w.status === "ARCHIVED" ? " · Archived" : ""}
                  </p>
                </div>
                {w.accessible ? (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => navigate(`/my-research/${w.id}`)}>
                    Open
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" aria-hidden /> Not shared with you
                  </span>
                )}
                {canManage ? (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void unlinkWorkspace(w)} aria-label={`Unlink ${w.name}`}>
                    <Unlink className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-violet-600" aria-hidden /> Group publications ({publications.length})
          </h3>
          {canManage ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void openPicker("publications")}>
              <Link2 className="h-4 w-4" aria-hidden /> Link publication
            </Button>
          ) : null}
        </div>
        {publications.length === 0 ? (
          <EmptyHint>No publications linked. Publications come from existing My Publications entries; nothing is duplicated.</EmptyHint>
        ) : (
          <ul className="divide-y rounded-lg border">
            {publications.map((p) => (
              <li key={p.claim_id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[p.authors, p.journal, p.year].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {canManage ? (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void unlinkPublication(p)} aria-label={`Unlink ${p.title}`}>
                    <Unlink className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={picker != null} onOpenChange={(open) => !open && setPicker(null)}>
        <DialogContent className="sm:max-w-lg [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>{picker === "workspaces" ? "Link workspaces" : "Link publications"}</DialogTitle>
            <DialogDescription>
              {picker === "workspaces"
                ? "Workspaces you can open that are owned by you or a group member. Linking does not share access."
                : "Your publication entries and approved entries submitted by group members."}
            </DialogDescription>
          </DialogHeader>
          {options.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nothing available to link.</p>
          ) : (
            <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
              {options.map((o) => {
                const id = `rg-link-${o.id}`;
                return (
                  <li key={o.id}>
                    <label htmlFor={id} className={`flex min-h-[44px] items-center gap-3 px-3 py-2 ${o.disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/50"}`}>
                      <Checkbox
                        id={id}
                        disabled={o.disabled}
                        checked={o.disabled || chosen.includes(o.id)}
                        onCheckedChange={(c) => setChosen((prev) => (c === true ? [...prev, o.id] : prev.filter((x) => x !== o.id)))}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{o.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {o.disabled ? "Already linked" : o.sub}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicker(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void link()} disabled={busy || chosen.length === 0} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Link {chosen.length > 0 ? `(${chosen.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
