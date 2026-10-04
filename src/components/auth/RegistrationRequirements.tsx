import { ChevronDown, FileText, ListChecks } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Requirement } from "@/lib/signupForm";

interface Props {
  items: Requirement[];
  /** Name of the chosen user type; the panel lists only its requirements. */
  typeName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegistrationRequirements({ items, typeName, open, onOpenChange }: Props) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-xl border border-border/80 bg-muted/25">
      <CollapsibleTrigger
        className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={open ? "Hide registration requirements" : "Show registration requirements"}
      >
        <span className="flex items-center gap-3">
          <ListChecks className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block text-base font-semibold text-foreground">Registration requirements</span>
            <span className="block text-sm text-muted-foreground">
              {typeName ? `What you need as ${typeName}` : "What you need, by user type"}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 text-sm font-medium text-primary">
          {open ? "Hide" : "Show"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-3 border-t border-border/60 px-5 py-4">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <div className="min-w-0 text-[15px] leading-relaxed">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-muted-foreground">{item.body}</p>
                {item.kycLink ? (
                  <a
                    href="/IIC_IIT_Roorkee_KYC_Form.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4 shrink-0" aria-hidden />
                    Download IIT Roorkee KYC Form (PDF)
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
