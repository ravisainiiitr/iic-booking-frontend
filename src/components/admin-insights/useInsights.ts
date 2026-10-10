import { useEffect, useRef, useState } from "react";

type Loader<T> = (params: Record<string, string | number | boolean>) => Promise<{ data?: T; error?: string }>;
type OptionsOf<T> = T extends { options?: infer O } ? O : undefined;

/**
 * Loads an insight page whenever ``params`` change (by value). Filter options are asked for on the first
 * load only and kept, so later responses can leave them out; a new ``optionsScope`` (e.g. another department)
 * asks for them again.
 */
export function useInsights<T extends object>(
  load: Loader<T>,
  params: Record<string, string | number | boolean>,
  errorText: string,
  optionsScope = "",
) {
  const [data, setData] = useState<T | null>(null);
  const [options, setOptions] = useState<OptionsOf<T> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const optionsLoaded = useRef(false);
  const loadedScope = useRef(optionsScope);
  if (loadedScope.current !== optionsScope) {
    loadedScope.current = optionsScope;
    optionsLoaded.current = false;
  }
  const loader = useRef(load);
  loader.current = load;
  const key = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query: Record<string, string | number | boolean> = JSON.parse(key);
    if (!optionsLoaded.current) query.with_options = true;
    loader.current(query).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error || errorText);
        return;
      }
      setError(null);
      setData(res.data);
      const opts = (res.data as { options?: OptionsOf<T> }).options;
      if (opts) {
        optionsLoaded.current = true;
        setOptions(opts);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, reloadKey, errorText]);

  return { data, options, loading, error, reload: () => setReloadKey((k) => k + 1) };
}
