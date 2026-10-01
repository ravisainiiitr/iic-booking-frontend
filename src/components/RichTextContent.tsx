import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { looksLikeRichHtml, sanitizeRichHtml } from "@/lib/richText";

type RichTextContentProps = {
  value: string | null | undefined;
  className?: string;
};

/** Renders OIC-formatted HTML (sanitized) or plain text with line breaks preserved. */
export function RichTextContent({ value, className }: RichTextContentProps) {
  const text = (value ?? "").trim();
  const html = useMemo(() => (looksLikeRichHtml(text) ? sanitizeRichHtml(text) : null), [text]);
  if (!text) return null;
  if (html === null) {
    return <div className={cn("whitespace-pre-wrap", className)}>{text}</div>;
  }
  return (
    <div
      className={cn(
        "rich-text-content [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_p]:my-1 [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
