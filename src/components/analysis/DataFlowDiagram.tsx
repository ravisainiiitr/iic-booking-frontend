import { ArrowDown, Download, FolderInput, FolderOutput, MonitorSmartphone, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const FLOW = [
  { label: "Booking RAW Data", icon: FolderInput },
  { label: "Portal", icon: null },
  { label: "Analysis Workspace", icon: null },
  { label: "Analysis PC", icon: MonitorSmartphone },
  { label: "Input Folder", icon: FolderInput },
  { label: "Analysis Software", icon: Sparkles },
  { label: "Output Folder", icon: FolderOutput },
  { label: "Portal", icon: null },
  { label: "Booking Results", icon: null },
  { label: "Download", icon: Download },
];

export function DataFlowDiagram({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-4 dark:border-border dark:from-muted/30 dark:to-card",
        className
      )}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Data flow
      </p>
      <div className="flex flex-col items-stretch gap-1 sm:hidden">
        {FLOW.map((step, idx) => (
          <div key={`${step.label}-${idx}`} className="flex flex-col items-center">
            <FlowChip label={step.label} Icon={step.icon} />
            {idx < FLOW.length - 1 ? (
              <ArrowDown className="my-1 h-3.5 w-3.5 text-slate-300" />
            ) : null}
          </div>
        ))}
      </div>
      <div className="hidden flex-wrap items-center justify-center gap-x-1 gap-y-2 sm:flex">
        {FLOW.map((step, idx) => (
          <div key={`${step.label}-${idx}`} className="flex items-center gap-1">
            <FlowChip label={step.label} Icon={step.icon} />
            {idx < FLOW.length - 1 ? (
              <span className="px-0.5 text-slate-300" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowChip({
  label,
  Icon,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }> | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm dark:border-border dark:bg-card dark:text-foreground">
      {Icon ? <Icon className="h-3 w-3 text-primary" /> : null}
      {label}
    </span>
  );
}
