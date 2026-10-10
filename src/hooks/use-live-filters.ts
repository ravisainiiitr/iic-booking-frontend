import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { dateFromIso } from "@/lib/dateFormat";
import { LIVE_SEARCH_DELAY_MS, LIVE_SEARCH_MIN_CHARS, nextLiveSearchTerm } from "@/hooks/use-live-search";

export type FilterValues = Record<string, string>;

export const DATE_RANGE_ORDER_MESSAGE = "The end date must be on or after the start date.";

/** True for a complete, real calendar date in YYYY-MM-DD form. */
export function isCompleteIsoDate(value: string | null | undefined): boolean {
  return dateFromIso(value) !== null;
}

/** Message to show under a date range whose dates are both set but out of order, else null. */
export function dateRangeError(from: string | null | undefined, to: string | null | undefined): string | null {
  return isCompleteIsoDate(from) && isCompleteIsoDate(to) && String(from) > String(to) ? DATE_RANGE_ORDER_MESSAGE : null;
}

export interface LiveFilterOptions<T extends FilterValues> {
  /** Free-text keys: applied after a pause from `minChars` characters, at once when cleared or on flush(). */
  text?: readonly (keyof T & string)[];
  /** Single date keys: only "" or a complete valid ISO date is applied; a half-typed date keeps the last one. */
  dates?: readonly (keyof T & string)[];
  /** [from, to] date keys: like `dates`, and nothing applies while from is after to (see `dateError`). */
  dateRanges?: readonly (readonly [keyof T & string, keyof T & string])[];
  /** Values to start from instead of the defaults (e.g. read from the URL); reset() still goes to the defaults. */
  start?: Partial<T>;
  minChars?: number;
  delayMs?: number;
}

type State<T extends FilterValues> = {
  /** Counts reset() calls so Clear refetches even when nothing else changed. */
  resets: number;
  /** What the inputs show. */
  values: T;
  /** Validated values, possibly with an out-of-order date range. */
  candidate: T;
  /** What the list fetches with: the last candidate whose date ranges were in order. */
  applied: T;
  dateError: string | null;
};

type Action<T extends FilterValues> =
  | { type: "set"; patch: Partial<T> }
  | { type: "applyText"; patch: Partial<T> }
  | { type: "flush" }
  | { type: "reset"; values: T };

type Config<T extends FilterValues> = {
  text: ReadonlySet<string>;
  dates: ReadonlySet<string>;
  ranges: readonly (readonly [string, string])[];
  minChars: number;
};

function sameValues<T extends FilterValues>(a: T, b: T): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}

function rangesError<T extends FilterValues>(values: T, config: Config<T>): string | null {
  for (const [from, to] of config.ranges) {
    const error = dateRangeError(values[from], values[to]);
    if (error) return error;
  }
  return null;
}

function finish<T extends FilterValues>(prev: State<T>, values: T, candidate: T, config: Config<T>): State<T> {
  const dateError = rangesError(candidate, config);
  const nextCandidate = sameValues(candidate, prev.candidate) ? prev.candidate : candidate;
  const nextApplied = dateError || sameValues(nextCandidate, prev.applied) ? prev.applied : nextCandidate;
  if (values === prev.values && nextCandidate === prev.candidate && nextApplied === prev.applied && dateError === prev.dateError) {
    return prev;
  }
  return { resets: prev.resets, values, candidate: nextCandidate, applied: nextApplied, dateError };
}

function initialState<T extends FilterValues>(values: T, config: Config<T>, resets = 0): State<T> {
  const candidate = { ...values };
  for (const k of config.text) candidate[k as keyof T] = nextLiveSearchTerm(values[k] ?? "", "", config.minChars) as T[keyof T];
  for (const k of config.dates) {
    const v = values[k] ?? "";
    if (v && !isCompleteIsoDate(v)) candidate[k as keyof T] = "" as T[keyof T];
  }
  const applied = { ...candidate };
  // An out-of-order start (e.g. from a link) fetches with that range left out.
  for (const [from, to] of config.ranges) {
    if (dateRangeError(candidate[from], candidate[to])) {
      applied[from as keyof T] = "" as T[keyof T];
      applied[to as keyof T] = "" as T[keyof T];
    }
  }
  return { resets, values, candidate, applied, dateError: rangesError(candidate, config) };
}

function makeReducer<T extends FilterValues>(config: Config<T>) {
  return (prev: State<T>, action: Action<T>): State<T> => {
    switch (action.type) {
      case "set": {
        const values = { ...prev.values, ...action.patch } as T;
        if (sameValues(values, prev.values)) return prev;
        const candidate = { ...prev.candidate };
        for (const k of Object.keys(action.patch)) {
          const v = values[k] ?? "";
          if (config.text.has(k)) {
            // Clearing a search box applies at once; typing waits for the pause (applyText).
            if (!v.trim()) candidate[k as keyof T] = "" as T[keyof T];
          } else if (config.dates.has(k)) {
            if (!v || isCompleteIsoDate(v)) candidate[k as keyof T] = v as T[keyof T];
          } else {
            candidate[k as keyof T] = v as T[keyof T];
          }
        }
        return finish(prev, values, candidate, config);
      }
      case "applyText":
        return finish(prev, prev.values, { ...prev.candidate, ...action.patch } as T, config);
      case "flush": {
        const candidate = { ...prev.candidate };
        for (const k of config.text) {
          candidate[k as keyof T] = nextLiveSearchTerm(prev.values[k] ?? "", prev.candidate[k] ?? "", config.minChars) as T[keyof T];
        }
        return finish(prev, prev.values, candidate, config);
      }
      case "reset":
        return initialState(action.values, config, prev.resets + 1);
    }
  };
}

export interface LiveFilters<T extends FilterValues> {
  /** Current input values (bind inputs to these). */
  values: T;
  /** Values the list should fetch with; a new object only when something applied changed. */
  applied: T;
  /** Stable string of `applied` (also changes on reset()), handy as an effect dependency. */
  appliedKey: string;
  /** Hint for an out-of-order date range; nothing applies until it is fixed. */
  dateError: string | null;
  /** True while typed text is waiting for the pause before it applies. */
  pending: boolean;
  /** True when every input is back at its default. */
  isDefault: boolean;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  setValues: (patch: Partial<T>) => void;
  /** Apply typed text now (Enter). */
  flush: () => void;
  /** onKeyDown for search boxes: Enter applies the text without waiting. */
  onSearchKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  /** Back to the defaults, applied at once. */
  reset: () => void;
  /** 1-based page; goes back to 1 whenever the applied filters change. */
  page: number;
  setPage: (page: number | ((p: number) => number)) => void;
}

/**
 * Filter state for lists that refresh as soon as a filter changes: selects, radios, checkboxes and
 * dates apply immediately, free text after a short pause (or Enter), dates only when complete and
 * in order, and the page goes back to 1 on every change.
 */
export function useLiveFilters<T extends FilterValues>(defaults: T, options: LiveFilterOptions<T> = {}): LiveFilters<T> {
  const minChars = options.minChars ?? LIVE_SEARCH_MIN_CHARS;
  const delayMs = options.delayMs ?? LIVE_SEARCH_DELAY_MS;
  const textKeys = (options.text ?? []).join("\u0000");
  const dateKeys = (options.dates ?? []).join("\u0000");
  const rangeKeys = (options.dateRanges ?? []).map((r) => r.join("\u0001")).join("\u0000");

  const config = useMemo<Config<T>>(() => {
    const ranges = rangeKeys ? rangeKeys.split("\u0000").map((r) => r.split("\u0001") as [string, string]) : [];
    return {
      text: new Set(textKeys ? textKeys.split("\u0000") : []),
      dates: new Set([...(dateKeys ? dateKeys.split("\u0000") : []), ...ranges.flat()]),
      ranges,
      minChars,
    };
  }, [textKeys, dateKeys, rangeKeys, minChars]);

  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const reducer = useMemo(() => makeReducer(config), [config]);
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState({ ...defaults, ...(options.start ?? {}) } as T, config),
  );

  const textValues = [...config.text].map((k) => state.values[k] ?? "").join("\u0000");
  useEffect(() => {
    const patch: Partial<T> = {};
    let changed = false;
    for (const k of config.text) {
      const next = nextLiveSearchTerm(state.values[k] ?? "", state.candidate[k] ?? "", minChars);
      if (next !== state.candidate[k]) {
        patch[k as keyof T] = next as T[keyof T];
        changed = true;
      }
    }
    if (!changed) return;
    const timer = window.setTimeout(() => dispatch({ type: "applyText", patch }), delayMs);
    return () => window.clearTimeout(timer);
    // Only a change of typed text restarts the pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textValues, delayMs, minChars, config]);

  const appliedKey = useMemo(() => `${JSON.stringify(state.applied)}#${state.resets}`, [state.applied, state.resets]);

  const [page, setPageState] = useState(1);
  const [pageKey, setPageKey] = useState(appliedKey);
  if (pageKey !== appliedKey) {
    setPageKey(appliedKey);
    setPageState(1);
  }

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    dispatch({ type: "set", patch: { [key]: value } as unknown as Partial<T> });
  }, []);
  const setValues = useCallback((patch: Partial<T>) => dispatch({ type: "set", patch }), []);
  const flush = useCallback(() => dispatch({ type: "flush" }), []);
  const onSearchKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    dispatch({ type: "flush" });
  }, []);
  const reset = useCallback(() => dispatch({ type: "reset", values: { ...defaultsRef.current } }), []);

  const pending = [...config.text].some(
    (k) => nextLiveSearchTerm(state.values[k] ?? "", state.candidate[k] ?? "", minChars) !== state.candidate[k],
  );
  const isDefault = sameValues(state.values, { ...state.values, ...defaults });

  return {
    values: state.values,
    applied: state.applied,
    appliedKey,
    dateError: state.dateError,
    pending,
    isDefault,
    set,
    setValues,
    flush,
    onSearchKeyDown,
    reset,
    page: pageKey !== appliedKey ? 1 : page,
    setPage: setPageState,
  };
}

/**
 * Hands out one request at a time: starting a new one aborts the previous signal and makes the
 * older request's `isLatest()` false, so a slow response never replaces a newer one.
 */
export function useLatestRequest() {
  const seq = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      seq.current += 1;
      controller.current?.abort();
    },
    [],
  );
  return useCallback(() => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    const id = ++seq.current;
    return { signal: c.signal, isLatest: () => id === seq.current };
  }, []);
}

/** Filter values found in the URL for the keys of `defaults` (other params are ignored). */
export function filtersFromSearchParams<T extends FilterValues>(params: URLSearchParams, defaults: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(defaults)) {
    const v = params.get(k);
    if (v != null) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

/** Keeps the URL query string in step with the applied filters, leaving defaults and other params alone. */
export function useSyncFiltersToUrl<T extends FilterValues>(
  applied: T,
  defaults: T,
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
) {
  const defaultsKey = JSON.stringify(defaults);
  const appliedKey = JSON.stringify(applied);
  const current = searchParams.toString();
  useEffect(() => {
    const defs = JSON.parse(defaultsKey) as T;
    const next = new URLSearchParams(current);
    for (const k of Object.keys(defs)) {
      const v = applied[k] ?? "";
      if (v !== "" && v !== defs[k]) next.set(k, v);
      else next.delete(k);
    }
    if (next.toString() !== current) setSearchParams(next, { replace: true });
    // `applied` is captured through appliedKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey, defaultsKey, current, setSearchParams]);
}
