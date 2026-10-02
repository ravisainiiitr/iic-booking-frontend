/** Accepts https://, http://, mailto:, bare domains (→ https) and email addresses (→ mailto). */
export function normalizeLinkInput(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)\S+$/i.test(v)) return v;
  if (/^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/.test(v)) return `mailto:${v}`;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v)) return `https://${v}`;
  return null;
}

/**
 * Microsoft Word pastes lists as `<p style="mso-list:l0 level1 lfo1">` paragraphs with the bullet or
 * number in a `mso-list:Ignore` span. Rebuild real (nested) `<ul>` / `<ol>` lists so they survive paste.
 */
export function convertWordLists(html: string): string {
  if (!/mso-list/i.test(html) || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const paras = Array.from(doc.body.querySelectorAll("p")).filter((p) =>
    /mso-list\s*:\s*l\d+\s+level\d+/i.test(p.getAttribute("style") || "")
  );
  let stack: { list: HTMLElement; level: number }[] = [];
  let expectedNext: Element | null = null;

  for (const p of paras) {
    const level = Number(/level(\d+)/i.exec(p.getAttribute("style") || "")?.[1] ?? "1");
    const markerEl = Array.from(p.querySelectorAll("span")).find((s) =>
      /mso-list\s*:\s*ignore/i.test(s.getAttribute("style") || "")
    );
    const marker = (markerEl?.textContent ?? "").replace(/\u00a0/g, " ").trim();
    markerEl?.remove();
    const ordered = /^(\d+|[a-z]|[ivxlcdm]+)[.)]$/i.test(marker);

    if (p !== expectedNext) stack = [];
    while (stack.length && stack[stack.length - 1].level > level) stack.pop();
    let top = stack[stack.length - 1];
    if (!top || top.level < level) {
      const list = doc.createElement(ordered ? "ol" : "ul");
      if (top) {
        let lastItem = top.list.lastElementChild;
        if (!lastItem) {
          lastItem = doc.createElement("li");
          top.list.appendChild(lastItem);
        }
        lastItem.appendChild(list);
      } else {
        p.before(list);
      }
      stack.push({ list, level });
      top = stack[stack.length - 1];
    }

    const item = doc.createElement("li");
    const para = doc.createElement("p");
    while (p.firstChild) para.appendChild(p.firstChild);
    item.appendChild(para);
    top.list.appendChild(item);
    expectedNext = p.nextElementSibling;
    p.remove();
  }
  return doc.body.innerHTML;
}
