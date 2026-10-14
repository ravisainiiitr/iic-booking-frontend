import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type MutableRefObject } from "react";

export const SELECT_CLICK_DELAY_MS = 280;

type Timer = ReturnType<typeof setTimeout>;

interface Options<K> {
  onSelect: (key: K) => void;
  onOpen: (key: K) => void;
  /** Runs at once on the first click or tap (and on Space), before the pause that tells a single click from a double. */
  onPress?: (key: K) => void;
  /** Skips the click (e.g. it ended a drag). */
  shouldIgnoreClick?: () => boolean;
  /** Pending single-click timer; pass one in when other code must be able to cancel it. */
  timerRef?: MutableRefObject<Timer | null>;
  delayMs?: number;
}

/**
 * One click selects (after a short pause, so a double click does not select first); a double click,
 * a double tap or Enter opens. Space selects straight away.
 */
export function useSelectOrOpenClick<K>({
  onSelect,
  onOpen,
  onPress,
  shouldIgnoreClick,
  timerRef,
  delayMs = SELECT_CLICK_DELAY_MS,
}: Options<K>) {
  const ownTimer = useRef<Timer | null>(null);
  const timer = timerRef ?? ownTimer;
  const pendingKey = useRef<K | null>(null);
  const latest = useRef({ onSelect, onOpen, onPress, shouldIgnoreClick });
  latest.current = { onSelect, onOpen, onPress, shouldIgnoreClick };

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pendingKey.current = null;
  }, [timer]);

  useEffect(() => cancel, [cancel]);

  const open = useCallback(
    (key: K) => {
      cancel();
      latest.current.onOpen(key);
    },
    [cancel],
  );

  return useCallback(
    (key: K) => ({
      onClick: (e: MouseEvent) => {
        if (latest.current.shouldIgnoreClick?.()) return;
        // Keyboard activation (Space) has no click count: select at once.
        if (e.detail === 0) {
          cancel();
          latest.current.onPress?.(key);
          latest.current.onSelect(key);
          return;
        }
        // Second click of a double click, or a second tap on browsers that do not count taps.
        if (e.detail === 2 || (timer.current && pendingKey.current === key)) {
          open(key);
          return;
        }
        if (e.detail > 2) return;
        // A quick click on another date keeps the first one's selection.
        const earlier = timer.current ? pendingKey.current : null;
        cancel();
        if (earlier !== null) latest.current.onSelect(earlier);
        latest.current.onPress?.(key);
        pendingKey.current = key;
        timer.current = setTimeout(() => {
          timer.current = null;
          pendingKey.current = null;
          latest.current.onSelect(key);
        }, delayMs);
      },
      onDoubleClick: (e: MouseEvent) => {
        e.preventDefault();
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        open(key);
      },
    }),
    [cancel, open, timer, delayMs],
  );
}
