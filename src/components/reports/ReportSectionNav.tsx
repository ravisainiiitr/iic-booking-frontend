import { cn } from "@/lib/utils";

export interface ReportSection {
  id: string;
  label: string;
}

/** Sticky jump-links between the sections of a long report (also hidden from print). */
export function ReportSectionNav({ sections, className }: { sections: ReportSection[]; className?: string }) {
  if (sections.length < 2) return null;
  return (
    <nav
      aria-label="Report sections"
      className={cn(
        "sticky top-0 z-20 -mx-4 mb-6 border-b bg-background/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 print:hidden",
        className,
      )}
    >
      <ul className="flex gap-1 overflow-x-auto">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => {
                const el = document.getElementById(s.id);
                if (!el) return;
                e.preventDefault();
                el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
