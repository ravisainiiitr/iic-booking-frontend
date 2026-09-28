import type { CSSProperties } from "react";

/** Diagonal hatch layered over the status colour, so staff still see the slot status. */
export const RESTRICTED_SLOT_HATCH =
  "repeating-linear-gradient(135deg, rgba(15, 23, 42, 0.30) 0 3px, transparent 3px 9px)";

export function isOutsideVisibilityWindow(
  slot: { outside_visibility_window?: boolean } | null | undefined
): boolean {
  return Boolean(slot?.outside_visibility_window);
}

export function restrictedSlotStyle(style?: CSSProperties): CSSProperties {
  return {
    ...style,
    backgroundImage: RESTRICTED_SLOT_HATCH,
    outline: "2px dashed rgba(15, 23, 42, 0.55)",
    outlineOffset: "-4px",
  };
}

function trimTime(value?: string | null): string {
  return value ? String(value).slice(0, 5) : "";
}

export function visibilityWindowRange(from?: string | null, to?: string | null): string {
  const f = trimTime(from);
  const t = trimTime(to);
  if (f && t) return `${f}–${t}`;
  if (f) return `from ${f}`;
  if (t) return `until ${t}`;
  return "";
}

export function restrictedSlotHint(from?: string | null, to?: string | null): string {
  const range = visibilityWindowRange(from, to);
  return `Outside the user visibility window${range ? ` (${range})` : ""}. Regular users cannot see this slot; only OIC and administrators can.`;
}
