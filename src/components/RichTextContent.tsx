import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { instructionToHtml } from "@/lib/richText";

type RichTextContentProps = {
  value: string | null | undefined;
  className?: string;
};

/** Renders OIC-formatted HTML (sanitized) or legacy plain text with its paragraphs and line breaks. */
export function RichTextContent({ value, className }: RichTextContentProps) {
  const html = useMemo(() => instructionToHtml(value), [value]);
  if (!html) return null;
  return (
    <div className={cn("rich-text-content", className)} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
