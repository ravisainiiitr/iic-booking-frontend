import DOMPurify from "dompurify";

/**
 * HTML in CMS page blocks keeps its formatting (including inline styles) but loses scripts, event handlers,
 * javascript: links, frames and forms. DOMPurify parses the markup, which the old pattern-stripping could be
 * tricked around.
 */
export function sanitizeCmsHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"] });
}
