import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type StepRow = {
  step_number: number;
  title: string;
  software_id?: string | null;
  capability_id?: string | null;
  mandatory: boolean;
  estimated_duration_minutes: number;
  expected_outputs: string[];
  operator_instructions: string;
  help_url: string;
  reference_manual_url: string;
  environment_label: string;
  description: string;
};

type WorkflowRow = {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  is_template?: boolean;
  estimated_duration_minutes?: number;
  published_version?: { label?: string; version_number?: number } | null;
  steps?: StepRow[];
};

const emptyStep = (n: number): StepRow => ({
  step_number: n,
  title: "",
  software_id: null,
  capability_id: null,
  mandatory: true,
  estimated_duration_minutes: 30,
  expected_outputs: [],
  operator_instructions: "",
  help_url: "",
  reference_manual_url: "",
  environment_label: "",
  description: "",
});

export default function WorkflowDesignerPage() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<WorkflowRow | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [newName, setNewName] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [ops, setOps] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const res = await apiClient.listAnalysisWorkflows();
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setWorkflows((res.data?.workflows as WorkflowRow[]) || []);
    const opsRes = await apiClient.getAnalysisWorkflowOpsDashboard();
    if (!opsRes.error) setOps(opsRes.data || null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const select = async (id: string) => {
    setSelectedId(id);
    const res = await apiClient.getAnalysisWorkflow(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const wf = res.data as WorkflowRow;
    setDraft(wf);
    setSteps((wf.steps as StepRow[]) || []);
  };

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await apiClient.createAnalysisWorkflow({ name: newName.trim() });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Workflow created");
      setNewName("");
      await load();
      if (res.data?.id) await select(String(res.data.id));
    } finally {
      setBusy(false);
    }
  };

  const saveMeta = async () => {
    if (!draft?.id) return;
    setBusy(true);
    try {
      const res = await apiClient.updateAnalysisWorkflow(draft.id, {
        name: draft.name,
        description: draft.description,
        estimated_duration_minutes: draft.estimated_duration_minutes,
        is_active: draft.is_active,
        is_template: draft.is_template,
      });
      if (res.error) toast.error(res.error);
      else toast.success("Saved");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const saveSteps = async () => {
    if (!draft?.id) return;
    setBusy(true);
    try {
      const normalized = steps.map((s, idx) => ({
        ...s,
        step_number: idx + 1,
        expected_outputs: Array.isArray(s.expected_outputs)
          ? s.expected_outputs
          : String(s.expected_outputs || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
      }));
      const res = await apiClient.saveAnalysisWorkflowSteps(draft.id, normalized);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Steps saved (draft)");
        await select(draft.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!draft?.id) return;
    setBusy(true);
    try {
      const res = await apiClient.publishAnalysisWorkflow(draft.id);
      if (res.error) toast.error(res.error);
      else toast.success("Published");
      await select(draft.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const clone = async () => {
    if (!draft?.id) return;
    setBusy(true);
    try {
      const res = await apiClient.cloneAnalysisWorkflow(draft.id, {
        name: `${draft.name} Advanced`,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Cloned");
        await load();
        if (res.data?.id) await select(String(res.data.id));
      }
    } finally {
      setBusy(false);
    }
  };

  const mapEquipment = async () => {
    if (!draft?.id || !equipmentId) return;
    setBusy(true);
    try {
      const res = await apiClient.mapAnalysisWorkflowEquipment(draft.id, {
        equipment_id: Number(equipmentId),
        is_default: true,
      });
      if (res.error) toast.error(res.error);
      else toast.success("Mapped to equipment (default)");
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...steps];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setSteps(next.map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analysis Workflow Designer</h1>
        <p className="text-muted-foreground">
          Create versioned multi-step pipelines, map them to equipment, and publish.
        </p>
      </div>

      {ops && (
        <Card>
          <CardHeader>
            <CardTitle>Operations</CardTitle>
            <CardDescription>Running analysis jobs and success metrics</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              Running: {Array.isArray(ops.running_workflows) ? ops.running_workflows.length : 0}
            </div>
            <div>
              Avg duration (min): {String(ops.average_workflow_duration_minutes ?? "—")}
            </div>
            <div>Success rate: {String(ops.workflow_success_rate_percent ?? "—")}%</div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Workflows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="New workflow name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button onClick={create} disabled={busy}>
                Add
              </Button>
            </div>
            <ul className="max-h-[28rem] space-y-1 overflow-auto">
              {workflows.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                      selectedId === w.id ? "bg-muted font-medium" : ""
                    }`}
                    onClick={() => void select(w.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{w.name}</span>
                      {!w.is_active ? <Badge variant="outline">off</Badge> : null}
                      {w.is_template ? <Badge variant="secondary">template</Badge> : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!draft ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Select or create a workflow.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{draft.name}</CardTitle>
                  <CardDescription>
                    Published:{" "}
                    {draft.published_version
                      ? draft.published_version.label || `v${draft.published_version.version_number}`
                      : "none"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Estimated minutes</Label>
                      <Input
                        type="number"
                        value={draft.estimated_duration_minutes || 60}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            estimated_duration_minutes: Number(e.target.value || 60),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={draft.description || ""}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveMeta} disabled={busy}>
                      Save details
                    </Button>
                    <Button variant="secondary" onClick={publish} disabled={busy}>
                      Publish
                    </Button>
                    <Button variant="outline" onClick={clone} disabled={busy}>
                      Duplicate
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                    <div>
                      <Label>Map equipment ID (default)</Label>
                      <Input
                        value={equipmentId}
                        onChange={(e) => setEquipmentId(e.target.value)}
                        placeholder="e.g. 42"
                      />
                    </div>
                    <Button variant="outline" onClick={mapEquipment} disabled={busy}>
                      Map equipment
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Steps</CardTitle>
                  <CardDescription>Reorder with up/down. Save writes a draft version.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={index} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">Step {index + 1}</p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => move(index, -1)}>
                            ↑
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => move(index, 1)}>
                            ↓
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSteps(steps.filter((_, i) => i !== index))}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Title"
                          value={step.title}
                          onChange={(e) => {
                            const next = [...steps];
                            next[index] = { ...step, title: e.target.value };
                            setSteps(next);
                          }}
                        />
                        <Input
                          placeholder="Analysis Environment label"
                          value={step.environment_label}
                          onChange={(e) => {
                            const next = [...steps];
                            next[index] = { ...step, environment_label: e.target.value };
                            setSteps(next);
                          }}
                        />
                        <Input
                          placeholder="Software UUID (optional)"
                          value={step.software_id || ""}
                          onChange={(e) => {
                            const next = [...steps];
                            next[index] = { ...step, software_id: e.target.value || null };
                            setSteps(next);
                          }}
                        />
                        <Input
                          placeholder="Capability UUID (optional)"
                          value={step.capability_id || ""}
                          onChange={(e) => {
                            const next = [...steps];
                            next[index] = { ...step, capability_id: e.target.value || null };
                            setSteps(next);
                          }}
                        />
                        <Input
                          type="number"
                          placeholder="Minutes"
                          value={step.estimated_duration_minutes}
                          onChange={(e) => {
                            const next = [...steps];
                            next[index] = {
                              ...step,
                              estimated_duration_minutes: Number(e.target.value || 30),
                            };
                            setSteps(next);
                          }}
                        />
                        <Input
                          placeholder="Expected outputs (*.xy, *.pdf)"
                          value={(step.expected_outputs || []).join(", ")}
                          onChange={(e) => {
                            const next = [...steps];
                            next[index] = {
                              ...step,
                              expected_outputs: e.target.value
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            };
                            setSteps(next);
                          }}
                        />
                      </div>
                      <Textarea
                        placeholder="Operator instructions"
                        value={step.operator_instructions}
                        onChange={(e) => {
                          const next = [...steps];
                          next[index] = { ...step, operator_instructions: e.target.value };
                          setSteps(next);
                        }}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Help URL"
                          value={step.help_url}
                          onChange={(e) => {
                            const next = [...steps];
                            next[index] = { ...step, help_url: e.target.value };
                            setSteps(next);
                          }}
                        />
                        <Input
                          placeholder="Reference manual URL"
                          value={step.reference_manual_url}
                          onChange={(e) => {
                            const next = [...steps];
                            next[index] = { ...step, reference_manual_url: e.target.value };
                            setSteps(next);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setSteps([...steps, emptyStep(steps.length + 1)])}
                    >
                      Add step
                    </Button>
                    <Button onClick={saveSteps} disabled={busy}>
                      Save step order
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
