import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Download, FileText, ImageIcon, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { attachmentObjectUrl, downloadAttachment, type AttachmentRef } from "@/lib/connectApi";
import { cn } from "@/lib/utils";
import { formatBytes } from "./useConnect";

const ALLOWED_TAGS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "del", "sub", "sup", "mark", "h3", "h4", "blockquote",
  "ul", "ol", "li", "pre", "code", "a", "span", "img", "table", "thead", "tbody", "tr", "th", "td",
];
const ALLOWED_ATTR = ["href", "target", "rel", "class", "data-mention-id", "data-attachment-id", "alt", "start", "colspan", "rowspan"];

/** Second, client-side sanitisation of server-sanitised HTML (defence in depth). Images never keep a src. */
export function cleanPostHtml(html: string): string {
  const clean = DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  });
  const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, "text/html");
  doc.querySelectorAll("img").forEach((img) => {
    if (!img.getAttribute("data-attachment-id")) img.remove();
    img.removeAttribute("src");
  });
  doc.querySelectorAll("a").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer nofollow ugc");
  });
  return doc.body.firstElementChild?.innerHTML ?? "";
}

/** Renders a post body. Inline images are fetched with the signed-in token and shown from a local blob URL. */
export function PostBody({ html, className }: { html: string; className?: string }) {
  const safe = useMemo(() => cleanPostHtml(html), [html]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const urls: string[] = [];
    let alive = true;
    root.querySelectorAll<HTMLImageElement>("img[data-attachment-id]").forEach((img) => {
      const id = img.getAttribute("data-attachment-id") || "";
      img.classList.add("connect-inline-image");
      img.loading = "lazy";
      void attachmentObjectUrl(id).then((url) => {
        if (!url) {
          img.alt = img.alt ? `${img.alt} (image unavailable)` : "Image unavailable";
          return;
        }
        if (!alive) {
          URL.revokeObjectURL(url);
          return;
        }
        urls.push(url);
        img.src = url;
      });
    });
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [safe]);

  return <div ref={ref} className={cn("connect-prose", className)} dangerouslySetInnerHTML={{ __html: safe }} />;
}

function AttachmentIcon({ kind }: { kind: AttachmentRef["kind"] }) {
  if (kind === "image") return <ImageIcon className="h-4 w-4" aria-hidden />;
  if (kind === "pdf" || kind === "text") return <FileText className="h-4 w-4" aria-hidden />;
  return <Paperclip className="h-4 w-4" aria-hidden />;
}

/** Downloadable files of a post (inline images are already shown in the text). */
export function AttachmentList({ items }: { items: AttachmentRef[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const files = items.filter((a) => !a.is_inline_image);
  if (!files.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attachments">
      {files.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            disabled={busy === a.id}
            onClick={async () => {
              setBusy(a.id);
              const ok = await downloadAttachment(a);
              setBusy(null);
              if (!ok) toast.error("This file is not available.");
            }}
            className="inline-flex max-w-[18rem] items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-60"
          >
            <AttachmentIcon kind={a.kind} />
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">{a.name}</span>
              <span className="text-muted-foreground">{formatBytes(a.size)}</span>
            </span>
            <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
