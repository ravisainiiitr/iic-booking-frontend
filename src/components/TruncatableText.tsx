import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Default character limit before showing Expand (equipment specs & important instruction). */
export const EQUIPMENT_TEXT_TRUNCATE_LIMIT = 200;

interface TruncatableTextProps {
  text: string;
  charLimit?: number;
  className?: string;
  expandLabel?: string;
  collapseLabel?: string;
}

export function TruncatableText({
  text,
  charLimit = EQUIPMENT_TEXT_TRUNCATE_LIMIT,
  className,
  expandLabel = "Expand",
  collapseLabel = "Show less",
}: TruncatableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const content = text || "";
  const collapsible = content.length > charLimit;
  const display =
    collapsible && !expanded ? `${content.slice(0, charLimit).trimEnd()}…` : content;

  if (!content) return null;

  return (
    <div>
      <div className={cn("whitespace-pre-line", className)}>{display}</div>
      {collapsible && (
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 mt-2 text-primary"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? collapseLabel : expandLabel}
        </Button>
      )}
    </div>
  );
}
