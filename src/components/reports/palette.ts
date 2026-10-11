/** One palette for every Reports & Statistics chart, so a category keeps its colour across charts. */
export const REPORT_PALETTE = [
  "#1e4d8c",
  "#0ea5e9",
  "#7c3aed",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#ec4899",
  "#64748b",
  "#14b8a6",
  "#a16207",
];

export const reportColor = (index: number) => REPORT_PALETTE[index % REPORT_PALETTE.length];

export const INTERNAL_COLOR = "#1e4d8c";
export const EXTERNAL_COLOR = "#f59e0b";
