import { useCallback, useState } from "react";

export function rememberedOpenKey(panel: string, userId?: number | string | null): string {
  return `iic-panel-open:${userId ?? "anon"}:${panel}`;
}

/** The user's saved choice, or null when they have never toggled the panel. */
export function readRememberedOpen(key: string): boolean | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* storage unavailable */
  }
  return null;
}

function writeRememberedOpen(key: string, open: boolean) {
  try {
    localStorage.setItem(key, open ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

/** Open/closed state of a collapsible panel, remembered per user; `defaultOpen` applies until the user toggles it. */
export function useRememberedOpen(
  panel: string,
  userId: number | string | null | undefined,
  defaultOpen: boolean,
): [boolean, (open: boolean) => void] {
  const key = rememberedOpenKey(panel, userId);
  const [choice, setChoice] = useState<{ key: string; open: boolean | null }>(() => ({
    key,
    open: readRememberedOpen(key),
  }));
  const saved = choice.key === key ? choice.open : readRememberedOpen(key);

  const setOpen = useCallback(
    (open: boolean) => {
      writeRememberedOpen(key, open);
      setChoice({ key, open });
    },
    [key],
  );

  return [saved ?? defaultOpen, setOpen];
}
