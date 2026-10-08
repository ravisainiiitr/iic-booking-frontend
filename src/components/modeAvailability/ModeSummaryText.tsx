import { Fragment } from "react";
import type { ModeSummaryPart } from "@/lib/modeAvailability";
import { cn } from "@/lib/utils";

type Props = {
  parts: ModeSummaryPart[];
  /** Classes for the mode code and the "|" separator (they differ on light and dark backgrounds). */
  codeClassName?: string;
  separatorClassName?: string;
  className?: string;
};

/** "● APREO Mon–Fri · full | ● EBSD not scheduled" on one truncated line. */
export default function ModeSummaryText({ parts, codeClassName, separatorClassName, className }: Props) {
  return (
    <span className={cn("block min-w-0 truncate", className)}>
      {parts.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 ? (
            <span className={cn("px-1.5", separatorClassName)} aria-hidden>
              |
            </span>
          ) : null}
          <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: p.color }} aria-hidden />
          <span className={cn("font-semibold", codeClassName)}>{p.code}</span> {p.text}
        </Fragment>
      ))}
    </span>
  );
}
