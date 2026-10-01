import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  INLINE_DYNAMIC_FIELD_TYPES,
  TOP_ALIGNED_DYNAMIC_FIELD_TYPES,
  normalizeDynamicFieldType,
} from "@/lib/dynamicFieldLayout";
import { cn } from "@/lib/utils";

type DynamicFieldRowProps = {
  fieldType: unknown;
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  /** "compact" is used inside nested cards such as extra sample sets. */
  density?: "comfortable" | "compact";
  /** Overrides the label's vertical alignment, e.g. "start" when a hint sits under a single-line control. */
  align?: "center" | "start";
  className?: string;
  labelClassName?: string;
  children: ReactNode;
};

/**
 * Label/control row for a dynamic booking input field: label in a left column and the control beside it on sm+,
 * stacked below sm. Tables always stay stacked.
 */
export function DynamicFieldRow({
  fieldType,
  label,
  htmlFor,
  required,
  density = "comfortable",
  align,
  className,
  labelClassName,
  children,
}: DynamicFieldRowProps) {
  const type = normalizeDynamicFieldType(fieldType);
  const compact = density === "compact";
  const inline = INLINE_DYNAMIC_FIELD_TYPES.has(type);
  const topAligned = align ? align === "start" : TOP_ALIGNED_DYNAMIC_FIELD_TYPES.has(type);

  const labelNode = (
    <Label
      htmlFor={htmlFor}
      className={cn(
        compact ? "text-xs" : "text-base",
        "leading-snug",
        inline && type === "PERIODIC_TABLE" && (compact ? "sm:pt-2.5" : "sm:pt-2"),
        inline && type === "ICPMS_STANDARD_COVERAGE" && (compact ? "sm:pt-3" : "sm:pt-2"),
        labelClassName
      )}
    >
      {label}
      {required && <span className="ml-1 text-destructive">*</span>}
    </Label>
  );

  if (!inline) {
    return (
      <div className={cn(compact ? "space-y-1" : "space-y-1.5", className)}>
        {labelNode}
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-1.5 sm:grid sm:space-y-0",
        compact
          ? "sm:grid-cols-[minmax(140px,40%)_1fr] sm:gap-x-3"
          : "sm:grid-cols-[minmax(180px,40%)_1fr] sm:gap-x-4",
        topAligned ? "sm:items-start" : "sm:items-center",
        className
      )}
    >
      {labelNode}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default DynamicFieldRow;
