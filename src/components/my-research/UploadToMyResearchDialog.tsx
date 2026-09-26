import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FlaskConical, Loader2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchWorkspaceOption } from "@/lib/myResearchTypes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadQueuePanel } from "./UploadQueuePanel";
import { useResearchUploads } from "./useResearchUploads";

interface Props {
  bookingId: number;
  bookingLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NEW = "__new__";

export function UploadToMyResearchDialog({ bookingId, bookingLabel, open, onOpenChange }: Props) {
  const [options, setOptions] = useState<ResearchWorkspaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [choice, setChoice] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploads = useResearchUploads(workspaceId);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    void apiClient.myResearchWorkspaceOptions(bookingId).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.error || !res.data) {
        toast.error(res.error || "Could not load your workspaces.");
        return;
      }
      setOptions(res.data.results);
      const linked = res.data.results.find((o) => o.booking_linked);
      setChoice(linked?.id ?? res.data.results[0]?.id ?? NEW);
    });
    return () => {
      alive = false;
    };
  }, [open, bookingId]);

  useEffect(() => {
    if (choice && choice !== NEW) setWorkspaceId(choice);
    else setWorkspaceId(null);
  }, [choice]);

  const createWorkspace = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await apiClient.createResearchWorkspace({ name: newName.trim() });
    setCreating(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not create the workspace.");
      return;
    }
    const created = { id: res.data.id, name: res.data.name, booking_linked: false };
    setOptions((prev) => [...prev, created]);
    setChoice(created.id);
    setNewName("");
  };

  const pick = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (list.length && workspaceId) uploads.addFiles(list, { bookingId });
  };

  const close = (next: boolean) => {
    if (!next && uploads.busy) {
      toast.info("Uploads are still running. Keep this window open until they finish.");
      return;
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-violet-600" /> Upload to My Research
          </DialogTitle>
          <DialogDescription>
            Save your own files for booking {bookingLabel} in a private research workspace. The booking is added to the
            workspace automatically.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Workspace</Label>
              <Select value={choice} onValueChange={setChoice} disabled={uploads.busy}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a workspace" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                      {o.booking_linked ? " (booking already added)" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW}>+ New workspace…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {choice === NEW ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Project name"
                  maxLength={200}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void createWorkspace();
                    }
                  }}
                />
                <Button onClick={createWorkspace} disabled={creating || !newName.trim()} className="gap-1.5">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create
                </Button>
              </div>
            ) : null}
            {workspaceId ? (
              <>
                <Button className="w-full gap-2 bg-violet-600 hover:bg-violet-700" onClick={() => inputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Choose files
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    pick(e.target.files);
                    e.target.value = "";
                  }}
                />
              </>
            ) : null}
            <UploadQueuePanel items={uploads.items} onCancel={uploads.cancel} onRetry={uploads.retry} onClear={uploads.clearFinished} />
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {workspaceId && !uploads.busy ? (
            <Button asChild variant="link" className="gap-1 px-0 text-violet-700 dark:text-violet-300">
              <Link to={`/my-research/${workspaceId}?tab=files`}>
                Open workspace <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <Button variant="outline" onClick={() => close(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
