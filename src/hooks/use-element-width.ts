import { useLayoutEffect, useState } from "react";

/**
 * Width of an element, kept up to date with ResizeObserver. Use the returned callback as the
 * element's `ref`. Lets a list pick a table or stacked cards from the space it actually has,
 * which inside the dashboard workspace is much narrower than the window.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, width] as const;
}
