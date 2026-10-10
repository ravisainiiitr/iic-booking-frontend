import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InsightMenuItem } from "./insightMenu";

export function InsightMenuCard({ item, onOpen }: { item: InsightMenuItem; onOpen: (path: string) => void }) {
  const Icon = item.icon;
  return (
    <Card
      role="button"
      tabIndex={0}
      className="h-full cursor-pointer overflow-hidden border-0 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
      onClick={() => onOpen(item.path)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item.path);
        }
      }}
    >
      <CardHeader className="pb-2">
        <div className="mb-1 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-brand text-white shadow-lg">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg">{item.label}</CardTitle>
            <CardDescription className="mt-0.5 text-sm">{item.description}</CardDescription>
          </div>
        </div>
        <div className="mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-sky-600 to-primary/50" />
      </CardHeader>
      <CardContent>
        <Button tabIndex={-1} className="w-full bg-brand text-white hover:bg-brand/90">
          Open
        </Button>
      </CardContent>
    </Card>
  );
}
