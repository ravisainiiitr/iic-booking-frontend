import type { ReactNode } from "react";

/** id for aria-describedby: the error when shown, otherwise the hint (SignupField renders one of them). */
export function describedBy(id: string, hint?: ReactNode, error?: string): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

/** 16px inputs with a clear focus ring; red border when invalid. */
export const SIGNUP_INPUT_CLASS =
  "h-12 rounded-xl border-border/80 bg-background text-base md:text-base aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30";
