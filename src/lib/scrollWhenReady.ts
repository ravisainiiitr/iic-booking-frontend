/** Scroll to the element with this id once it has rendered (polls until `timeoutMs`). Returns a cancel function. */
export function scrollWhenReady(elementId: string, timeoutMs = 6000, intervalMs = 150): () => void {
  const started = Date.now();
  const timer = window.setInterval(() => {
    const el = document.getElementById(elementId);
    if (el) {
      window.clearInterval(timer);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (Date.now() - started > timeoutMs) {
      window.clearInterval(timer);
    }
  }, intervalMs);
  return () => window.clearInterval(timer);
}
