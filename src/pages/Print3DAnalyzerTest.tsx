import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  analyzeStlFile,
  DEFAULT_PRINT_SETTINGS,
  formatDuration,
  materialUsageFactor,
  PRINT_MATERIALS,
  type PrintSettings,
  type StlAnalysisResult,
} from "@/lib/stlAnalysis";
import { StlModelPreview } from "@/components/StlModelPreview";
import {
  ArrowLeft,
  Box,
  Clock,
  FileUp,
  IndianRupee,
  Scale,
  Triangle,
  Upload,
  X,
} from "lucide-react";

const DEFAULT_BED = { x: 220, y: 220, z: 250 };
const MAX_STL_BYTES = 100 * 1024 * 1024;

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function BoundingBoxPreview({
  size,
  bed,
}: {
  size: { x: number; y: number; z: number };
  bed: { x: number; y: number; z: number };
}) {
  const pad = 16;
  const viewW = 280;
  const viewH = 200;
  const scale = Math.min(
    (viewW - pad * 2) / Math.max(bed.x, size.x, 1),
    (viewH - pad * 2) / Math.max(bed.y, size.y, 1),
  );
  const bedW = bed.x * scale;
  const bedH = bed.y * scale;
  const modelW = size.x * scale;
  const modelH = size.y * scale;
  const ox = (viewW - bedW) / 2;
  const oy = (viewH - bedH) / 2;
  const mx = ox + (bedW - modelW) / 2;
  const my = oy + (bedH - modelH) / 2;
  const fits = size.x <= bed.x && size.y <= bed.y && size.z <= bed.z;

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full max-w-xs mx-auto" aria-hidden>
      <rect
        x={ox}
        y={oy}
        width={bedW}
        height={bedH}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-muted-foreground"
        strokeDasharray="4 3"
      />
      <rect
        x={mx}
        y={my}
        width={modelW}
        height={modelH}
        fill="currentColor"
        className={cn("opacity-30", fits ? "text-primary" : "text-destructive")}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <text x={viewW / 2} y={viewH - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
        Top view — bed {bed.x}×{bed.y} mm
      </text>
    </svg>
  );
}

export default function Print3DAnalyzerTest() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [materialId, setMaterialId] = useState(PRINT_MATERIALS[0].id);
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [bedSize, setBedSize] = useState(DEFAULT_BED);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StlAnalysisResult | null>(null);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);

  const material = useMemo(
    () => PRINT_MATERIALS.find((m) => m.id === materialId) ?? PRINT_MATERIALS[0],
    [materialId],
  );

  const usageFactor = materialUsageFactor(settings.infillPercent);

  const runAnalysis = useCallback(
    async (selectedFile: File) => {
      setLoading(true);
      setResult(null);
      try {
        const analysis = await analyzeStlFile(selectedFile, material, settings, bedSize);
        setResult(analysis);
        if (analysis.warnings.length > 0) {
          toast.warning(analysis.warnings.join(" "));
        } else {
          toast.success("STL analyzed successfully.");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to analyze STL.";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [material, settings, bedSize],
  );

  const onFileSelected = (selected: File | null) => {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".stl")) {
      toast.error("Please upload a .stl file.");
      return;
    }
    if (selected.size > MAX_STL_BYTES) {
      toast.error("File must be under 100 MB.");
      return;
    }
    setFile(selected);
    void selected.arrayBuffer().then(setStlBuffer);
  };

  useEffect(() => {
    if (file) {
      void runAnalysis(file);
    }
  }, [file, runAnalysis]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    onFileSelected(dropped ?? null);
  };

  const clear = () => {
    setFile(null);
    setResult(null);
    setStlBuffer(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Link>
          </Button>
          <Badge variant="outline">Test page</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              3D Print STL Analyzer
            </CardTitle>
            <CardDescription>
              Upload an STL to estimate print weight, time, and material cost. Analysis runs in the
              browser using assumed slicer settings — for quoting experiments only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                "hover:border-primary/50 hover:bg-muted/30",
                file && "border-primary/40 bg-muted/20",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".stl"
                className="hidden"
                onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="space-y-2">
                  <FileUp className="h-10 w-10 mx-auto text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <div className="flex justify-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => file && void runAnalysis(file)}
                      disabled={loading}
                    >
                      Re-analyze
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clear}>
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Drag & drop an STL file, or</p>
                  <Button onClick={() => inputRef.current?.click()} disabled={loading}>
                    Choose file
                  </Button>
                </div>
              )}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">3D preview</CardTitle>
                <CardDescription>Interactive view of the uploaded mesh</CardDescription>
              </CardHeader>
              <CardContent>
                <StlModelPreview buffer={stlBuffer} bedSize={bedSize} />
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Material</Label>
                  <Select value={materialId} onValueChange={setMaterialId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRINT_MATERIALS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label} — ₹{m.pricePerGram}/g, ρ {m.densityGPerCm3} g/cm³
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Layer height (mm)</Label>
                  <Select
                    value={String(settings.layerHeightMm)}
                    onValueChange={(v) =>
                      setSettings((s) => ({ ...s, layerHeightMm: parseFloat(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.1">0.10 mm (fine)</SelectItem>
                      <SelectItem value="0.2">0.20 mm (standard)</SelectItem>
                      <SelectItem value="0.3">0.30 mm (draft)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Infill</Label>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {settings.infillPercent}%
                    </span>
                  </div>
                  <Slider
                    min={5}
                    max={100}
                    step={5}
                    value={[settings.infillPercent]}
                    onValueChange={([v]) =>
                      setSettings((s) => ({ ...s, infillPercent: v }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Material usage factor: {(usageFactor * 100).toFixed(0)}% of solid volume
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base">Printer bed size (mm)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["x", "y", "z"] as const).map((axis) => (
                    <div key={axis} className="space-y-1">
                      <Label className="text-xs uppercase text-muted-foreground">{axis}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={bedSize[axis]}
                        onChange={(e) =>
                          setBedSize((b) => ({
                            ...b,
                            [axis]: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Used to warn if the model bounding box exceeds the build volume.
                </p>
              </div>
            </div>

            {loading && (
              <p className="text-center text-muted-foreground animate-pulse">Analyzing mesh…</p>
            )}

            {result && !loading && (
              <>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="Weight"
                    value={`${result.weightGrams.toFixed(1)} g`}
                    sub={`${result.volumeCm3.toFixed(2)} cm³ solid`}
                    icon={Scale}
                  />
                  <MetricCard
                    label="Print time"
                    value={formatDuration(result.estimatedTimeMinutes)}
                    sub="heuristic estimate"
                    icon={Clock}
                  />
                  <MetricCard
                    label="Material cost"
                    value={`₹${result.materialCost.toFixed(2)}`}
                    sub={`${material.label} @ ₹${material.pricePerGram}/g`}
                    icon={IndianRupee}
                  />
                  <MetricCard
                    label="Triangles"
                    value={result.triangleCount.toLocaleString()}
                    sub={`${result.surfaceAreaMm2.toFixed(0)} mm² surface`}
                    icon={Triangle}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Bounding box</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">X</span>{" "}
                          <span className="font-medium tabular-nums">
                            {result.boundingBox.size.x.toFixed(2)} mm
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Y</span>{" "}
                          <span className="font-medium tabular-nums">
                            {result.boundingBox.size.y.toFixed(2)} mm
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Z</span>{" "}
                          <span className="font-medium tabular-nums">
                            {result.boundingBox.size.z.toFixed(2)} mm
                          </span>
                        </div>
                      </div>
                      <BoundingBoxPreview size={result.boundingBox.size} bed={bedSize} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Booking preview values</CardTitle>
                      <CardDescription>
                        These would map to dynamic input fields A / B / C in a real booking.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <dl className="space-y-2 text-sm font-mono">
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">A (weight g)</dt>
                          <dd>{result.weightGrams.toFixed(2)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">B (material)</dt>
                          <dd>{material.id}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">C (time min)</dt>
                          <dd>{result.estimatedTimeMinutes}</dd>
                        </div>
                        <div className="flex justify-between gap-4 border-t pt-2">
                          <dt className="text-muted-foreground">Charge (material)</dt>
                          <dd>₹{result.materialCost.toFixed(2)}</dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                </div>

                {result.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm space-y-1">
                    <p className="font-medium text-amber-800 dark:text-amber-200">Warnings</p>
                    <ul className="list-disc list-inside text-amber-900/80 dark:text-amber-100/80">
                      {result.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
