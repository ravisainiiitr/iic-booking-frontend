import { useEffect, useRef, useState } from "react";

type Loader<T> = (params: Record<string, string | number | boolean>) => Promise<{ data?: T; error?: string }>;

/**
 * Loads an insight page whenever ``params`` change (by value). Filter options are asked for on the first
 * load only and kept, so later responses can leave them out.
 */
export function useInsights<T extends { options?: unknown }>(
  load: Loader<T>,
  params: Record<string, string | number | boolean>,
  errorText: string,
) {
  const [data, setData] = useState<T | null>(null);
  const [options, setOptions] = useState<T["options"]>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const optionsLoaded = useRef(false);
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
      if (res.data.options) {
        optionsLoaded.current = true;
        setOptions(res.data.options);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, reloadKey, errorText]);

  return { data, options, loading, error, reload: () => setReloadKey((k) => k + 1) };
}
