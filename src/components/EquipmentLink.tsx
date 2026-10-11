import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Equipment name that opens its equipment page; plain text without an id. */
export function EquipmentLink({
  id,
  name,
  code,
  showCode = false,
  className,
  children,
}: {
  id: number | string | null | undefined;
  name?: string | null;
  code?: string | null;
  /** Show the code on a second, muted line. */
  showCode?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const label = children ?? (name?.trim() || code?.trim() || "—");
  const codeLine = showCode && code?.trim() ? <span className="block text-xs font-normal text-muted-foreground">{code}</span> : null;
  if (id == null || String(id).trim() === "") {
    return (
      <span className={className}>
        {label}
        {codeLine}
      </span>
    );
  }
  return (
    <span className={className}>
      <Link
        to={`/equipment/${encodeURIComponent(String(id))}`}
        className="text-primary underline-offset-2 hover:underline"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {label}
      </Link>
      {codeLine}
    </span>
  );
}

export default EquipmentLink;
