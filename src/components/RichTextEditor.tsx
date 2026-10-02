import { Suspense, lazy } from "react";
import { cn } from "@/lib/utils";
import type { RichTextEditorProps } from "@/components/rich-text/RichTextEditorCore";

const RichTextEditorCore = lazy(() => import("@/components/rich-text/RichTextEditorCore"));

/** Word-like editor for OIC-formatted text; the editor bundle loads only when this is rendered. */
export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense
      fallback={
        <div
          className={cn("animate-pulse rounded-md border bg-muted/30", props.minHeightClass ?? "min-h-[8rem]")}
          aria-busy="true"
          aria-label={props.ariaLabel ? `${props.ariaLabel} (loading editor)` : "Loading editor"}
        />
      }
    >
      <RichTextEditorCore {...props} />
    </Suspense>
  );
}
