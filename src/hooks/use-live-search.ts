import { useEffect, useState } from "react";

export const LIVE_SEARCH_MIN_CHARS = 2;
export const LIVE_SEARCH_DELAY_MS = 350;

/**
 * The term a list should search for after the user typed `raw`: "" once the box is cleared, the
 * trimmed text from `minChars` characters, and otherwise (a single character) the current term.
 */
export function nextLiveSearchTerm(raw: string, current: string, minChars = LIVE_SEARCH_MIN_CHARS): string {
  const text = raw.trim();
  if (!text) return "";
  return text.length < minChars ? current : text;
}

/**
 * Debounced search term for lists that refresh while the user types. Clearing the box applies at
 * once; the setter applies a term immediately (e.g. when a page fills the box from a link).
 */
export function useLiveSearchTerm(
  raw: string,
  { minChars = LIVE_SEARCH_MIN_CHARS, delayMs = LIVE_SEARCH_DELAY_MS }: { minChars?: number; delayMs?: number } = {},
) {
  const [term, setTerm] = useState(() => nextLiveSearchTerm(raw, "", minChars));

  useEffect(() => {
    const text = raw.trim();
    if (!text) {
      setTerm("");
      return;
    }
    if (text.length < minChars) return;
    const timer = window.setTimeout(() => setTerm(text), delayMs);
    return () => window.clearTimeout(timer);
  }, [raw, minChars, delayMs]);

  return [term, setTerm] as const;
}
