import { toast } from "sonner";
import type { GuideSection, UserGuideContent } from "@/guides/types";

export const WHATS_NEW_ID = "whats-new";

function sectionText(s: GuideSection): string {
  return [
    s.title,
    s.group,
    ...s.intro,
    ...(s.steps ?? []).flatMap((st) => [st.title, st.body]),
    ...(s.rules ?? []),
    ...(s.tips ?? []),
    ...(s.glossary ?? []).flatMap((x) => [x.term, x.meaning]),
    ...(s.faqs ?? []).flatMap((f) => [f.question, f.answer]),
  ]
    .join(" ")
    .toLowerCase();
}

export function sectionMatches(s: GuideSection, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || sectionText(s).includes(q);
}

export function groupSections(sections: GuideSection[]): Array<{ group: string; sections: GuideSection[] }> {
  const groups: Array<{ group: string; sections: GuideSection[] }> = [];
  for (const s of sections) {
    const last = groups[groups.length - 1];
    if (last && last.group === s.group) last.sections.push(s);
    else groups.push({ group: s.group, sections: [s] });
  }
  return groups;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const list = (items: string[] | undefined, cls: string, title: string) =>
  items?.length ? `<div class="${cls}"><h4>${title}</h4><ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : "";

/** Printable HTML (Save as PDF) of the signed-in user's guide; `userName` (e.g. "Prof. Ravi Saini") goes in the header. */
export function guideToPrintHtml(guide: UserGuideContent, userName?: string | null): string {
  const preparedFor = (userName || "").trim();
  const whatsNew = guide.whatsNew.items.length
    ? `<section><h2>What's New — ${escapeHtml(guide.whatsNew.date)}</h2><ul>${guide.whatsNew.items
        .map((i) => `<li><strong>${escapeHtml(i.title)}</strong> — ${escapeHtml(i.benefit)}</li>`)
        .join("")}</ul></section>`
    : "";
  const sections = guide.sections
    .map(
      (s) => `<section>
  <p class="group">${escapeHtml(s.group)}</p><h2>${escapeHtml(s.title)}</h2>
  <h4>What it is</h4>${s.intro.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
  ${s.glossary?.length ? `<dl>${s.glossary.map((g) => `<dt>${escapeHtml(g.term)}</dt><dd>${escapeHtml(g.meaning)}</dd>`).join("")}</dl>` : ""}
  ${s.steps?.length ? `<h4>How to</h4><ol>${s.steps.map((st) => `<li><strong>${escapeHtml(st.title)}.</strong> ${escapeHtml(st.body)}</li>`).join("")}</ol>` : ""}
  ${list(s.rules, "rules", "Rules / limits")}
  ${list(s.tips, "tips", "Tips")}
  ${s.faqs?.length ? `<h4>Questions</h4>${s.faqs.map((f) => `<p><strong>${escapeHtml(f.question)}</strong><br/>${escapeHtml(f.answer)}</p>`).join("")}` : ""}
</section>`
    )
    .join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(guide.title)}</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:2rem auto;padding:0 1.25rem;color:#111827;line-height:1.55;font-size:14px}
h1{font-size:1.6rem;margin:0}.for{font-weight:600;margin:.35rem 0 0}.sub{color:#6b7280;margin:.25rem 0 1.5rem}
section{break-inside:avoid-page;margin-top:1.5rem}h2{font-size:1.15rem;margin:.1rem 0 .5rem;border-bottom:1px solid #e5e7eb;padding-bottom:.3rem}
.group{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:0}
h4{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:1rem 0 .3rem}
ol,ul{padding-left:1.25rem}li{margin:.2rem 0}dl{margin:.5rem 0}dt{font-weight:600}dd{margin:0 0 .4rem 0;color:#374151}
.rules{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:.25rem .75rem}.tips{background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:.25rem .75rem}
@media print{body{margin:0}}
</style></head><body>
<h1>${escapeHtml(guide.title)}</h1>${preparedFor ? `<p class="for">Prepared for ${escapeHtml(preparedFor)}</p>` : ""}<p class="sub">${escapeHtml(guide.audienceLabel)} · ${escapeHtml(guide.welcomeBody)}</p>
${whatsNew}${sections}
</body></html>`;
}

export function openPrintableGuide(guide: UserGuideContent, userName?: string | null) {
  const blob = new Blob([guideToPrintHtml(guide, userName)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    toast.error("Please allow pop-ups to save the user guide as PDF.");
    return;
  }
  window.setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, 400);
}
