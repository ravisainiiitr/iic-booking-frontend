import { lazy, Suspense } from "react";
import type { TypedTableInputProps } from "@/components/TypedTableInput";

const TypedTableInput = lazy(() => import("@/components/TypedTableInput"));

/** Loads the advanced-table editor only when an equipment actually has a TYPED_TABLE field. */
export function TypedTableInputLazy(props: TypedTableInputProps) {
  return (
    <Suspense fallback={<div className="h-24 animate-pulse rounded-md border bg-muted/40" aria-busy="true" />}>
      <TypedTableInput {...props} />
    </Suspense>
  );
}

export default TypedTableInputLazy;
