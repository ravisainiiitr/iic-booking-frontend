import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { periodicTableElements, getCategoryColor, type Element } from "@/data/periodicTableData";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export default function IcpmsStandardsTest() {
  const [selectedElements, setSelectedElements] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | {
    count: number;
    standards: Array<{ id: number; s_no: string; name_of_std: string; list_of_elements?: string }>;
    uncovered?: string[];
    error?: string;
  }>(null);

  const toggleElement = (atomicNumber: number) => {
    setSelectedElements((prev) => {
      const next = new Set(prev);
      if (next.has(atomicNumber)) next.delete(atomicNumber);
      else next.add(atomicNumber);
      return next;
    });
  };

  const elementsSymbols = useMemo(() => {
    return Array.from(selectedElements)
      .sort((a, b) => a - b)
      .map((an) => periodicTableElements.find((e) => e.atomicNumber === an)?.symbol)
      .filter((s): s is string => !!s);
  }, [selectedElements]);

  const createGrid = () => {
    const grid: (Element | null)[][] = Array(7)
      .fill(null)
      .map(() => Array(18).fill(null));
    periodicTableElements.forEach((element) => {
      if (element.row <= 7 && element.col <= 18) grid[element.row - 1][element.col - 1] = element;
    });
    return grid;
  };
  const grid = createGrid();
  const lanthanides = periodicTableElements.filter((el) => el.category === "lanthanide");
  const actinides = periodicTableElements.filter((el) => el.category === "actinide");

  const renderElement = (element: Element | null) => {
    if (!element) return <div className="w-12 h-12 md:w-14 md:h-14" />;
    const isSelected = selectedElements.has(element.atomicNumber);
    return (
      <button
        key={element.atomicNumber}
        onClick={() => toggleElement(element.atomicNumber)}
        className={cn(
          "w-12 h-12 md:w-14 md:h-14 border-2 rounded flex flex-col items-center justify-center text-xs transition-all relative group",
          getCategoryColor(element.category),
          isSelected && "ring-2 ring-primary ring-offset-2 scale-105"
        )}
        title={element.name}
      >
        {isSelected && (
          <Check className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full p-0.5" />
        )}
        <div className="text-[10px] text-muted-foreground">{element.atomicNumber}</div>
        <div className="font-bold">{element.symbol}</div>
        <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground px-2 py-1 rounded text-xs whitespace-nowrap z-10 -bottom-8 shadow-lg border">
          {element.name}
        </div>
      </button>
    );
  };

  const onSolve = async () => {
    if (elementsSymbols.length === 0) {
      toast.error("Please select at least one element.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await apiClient.getIcpmsMinStandardsCover(elementsSymbols);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setResult(res.data as any);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to compute standards.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>ICPMS Standards Coverage Test</CardTitle>
            <Badge variant="secondary" className="text-base px-3 py-1">
              Selected: {selectedElements.size}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="default" onClick={onSolve} disabled={loading}>
                {loading ? "Computing..." : "Find minimum standards"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedElements(new Set());
                  setResult(null);
                }}
                disabled={loading}
              >
                Clear
              </Button>
            </div>

            <div className="overflow-x-auto pb-4">
              <div className="inline-block min-w-max">
                <div className="flex flex-col gap-1">
                  {grid.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-1">
                      {row.map((element, colIndex) => (
                        <div key={`${rowIndex}-${colIndex}`}>{renderElement(element)}</div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex gap-1">
                    <div className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-xs font-semibold">Ln</div>
                    {lanthanides.map((element) => renderElement(element))}
                  </div>
                  <div className="flex gap-1">
                    <div className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-xs font-semibold">Ac</div>
                    {actinides.map((element) => renderElement(element))}
                  </div>
                </div>
              </div>
            </div>

            {elementsSymbols.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Elements: <span className="text-foreground">{elementsSymbols.join(", ")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.error ? (
                <div className="text-sm text-destructive">{result.error}</div>
              ) : (
                <div className="text-sm">
                  Minimum standards required: <span className="font-semibold">{result.count}</span>
                </div>
              )}

              {Array.isArray(result.uncovered) && result.uncovered.length > 0 && (
                <div className="text-sm text-destructive">Uncovered: {result.uncovered.join(", ")}</div>
              )}

              {Array.isArray(result.standards) && result.standards.length > 0 && (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left font-medium p-2 border-r">S.NO.</th>
                        <th className="text-left font-medium p-2 border-r">Name of Std</th>
                        <th className="text-left font-medium p-2">List of Element</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.standards.map((s) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="p-2 border-r align-top font-medium">{s.s_no}</td>
                          <td className="p-2 border-r align-top">{s.name_of_std}</td>
                          <td className="p-2 align-top break-words max-w-[min(100%,28rem)]">
                            {(s.list_of_elements && String(s.list_of_elements).trim()) || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

