import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check } from "lucide-react";
import { periodicTableElements, getCategoryColor, Element } from "@/data/periodicTableData";
import { cn } from "@/lib/utils";

const PeriodicTable = () => {
  const navigate = useNavigate();
  const [selectedElements, setSelectedElements] = useState<Set<number>>(new Set());

  const toggleElement = (atomicNumber: number) => {
    setSelectedElements((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(atomicNumber)) {
        newSet.delete(atomicNumber);
      } else {
        newSet.add(atomicNumber);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedElements(new Set());
  };

  // Create a grid representation
  const createGrid = () => {
    const grid: (Element | null)[][] = Array(7)
      .fill(null)
      .map(() => Array(18).fill(null));

    periodicTableElements.forEach((element) => {
      // Place main elements
      if (element.row <= 7 && element.col <= 18) {
        grid[element.row - 1][element.col - 1] = element;
      }
    });

    return grid;
  };

  const grid = createGrid();
  const lanthanides = periodicTableElements.filter(
    (el) => el.category === "lanthanide"
  );
  const actinides = periodicTableElements.filter(
    (el) => el.category === "actinide"
  );

  const renderElement = (element: Element | null) => {
    if (!element) {
      return <div className="w-12 h-12 md:w-14 md:h-14" />;
    }

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
        <div className="text-[10px] text-muted-foreground">
          {element.atomicNumber}
        </div>
        <div className="font-bold">{element.symbol}</div>
        <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground px-2 py-1 rounded text-xs whitespace-nowrap z-10 -bottom-8 shadow-lg border">
          {element.name}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold">Periodic Table</h1>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              Selected: {selectedElements.size}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Select Elements</CardTitle>
              {selectedElements.size > 0 && (
                <Button variant="outline" onClick={clearSelection}>
                  Clear Selection
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Main periodic table */}
            <div className="overflow-x-auto pb-4">
              <div className="inline-block min-w-max">
                <div className="flex flex-col gap-1">
                  {grid.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-1">
                      {row.map((element, colIndex) => (
                        <div key={`${rowIndex}-${colIndex}`}>
                          {renderElement(element)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Lanthanides and Actinides */}
                <div className="mt-4 space-y-2">
                  <div className="flex gap-1">
                    <div className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-xs font-semibold">
                      Ln
                    </div>
                    {lanthanides.map((element) => renderElement(element))}
                  </div>
                  <div className="flex gap-1">
                    <div className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-xs font-semibold">
                      Ac
                    </div>
                    {actinides.map((element) => renderElement(element))}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-semibold mb-3">Element Categories</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { name: "Alkali Metal", category: "alkali-metal" },
                  { name: "Alkaline Earth", category: "alkaline-earth" },
                  { name: "Transition Metal", category: "transition-metal" },
                  { name: "Post-transition", category: "post-transition" },
                  { name: "Metalloid", category: "metalloid" },
                  { name: "Nonmetal", category: "nonmetal" },
                  { name: "Halogen", category: "halogen" },
                  { name: "Noble Gas", category: "noble-gas" },
                  { name: "Lanthanide", category: "lanthanide" },
                  { name: "Actinide", category: "actinide" },
                ].map(({ name, category }) => (
                  <div key={category} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-4 h-4 border-2 rounded",
                        getCategoryColor(category)
                      )}
                    />
                    <span className="text-xs">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected elements list */}
        {selectedElements.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Selected Elements ({selectedElements.size})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from(selectedElements)
                  .sort((a, b) => a - b)
                  .map((atomicNumber) => {
                    const element = periodicTableElements.find(
                      (el) => el.atomicNumber === atomicNumber
                    );
                    if (!element) return null;
                    return (
                      <div
                        key={element.atomicNumber}
                        className={cn(
                          "p-3 border-2 rounded-lg flex items-center justify-between",
                          getCategoryColor(element.category)
                        )}
                      >
                        <div>
                          <div className="font-bold">{element.symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            {element.name}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleElement(element.atomicNumber)}
                          className="h-6 w-6 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default PeriodicTable;
