import { confidence } from "./mappingModel";

const TONES = {
  strong: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  good: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  weak: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

export default function ConfidencePill({ score }: { score: number }) {
  const c = confidence(score);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[c.tone]}`}
      title={`Match ${Math.round(score * 100)}%`}>
      {c.label}
    </span>
  );
}
