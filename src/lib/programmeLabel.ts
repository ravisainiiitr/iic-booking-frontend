function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * "Ph.D. - Doctor of Philosophy" + "Ph.D. Physics" -> "Ph.D. Physics"; "M.Tech" + "Chemical" -> "M.Tech Chemical".
 * The degree's long expansion after " - " is dropped, and so is the degree when the branch already names it.
 * Mirrors the backend identity card `_programme_label`.
 */
export function formatProgramme(degree?: string | null, branch?: string | null): string {
  const degreeShort = (degree ?? "").trim().split(/\s+[-–—]\s+/)[0].trim();
  const branchName = (branch ?? "").trim();
  if (!branchName) return degreeShort;
  if (!degreeShort) return branchName;
  const token = degreeShort.replace(/[.\s]/g, "").toLowerCase();
  const branchPlain = branchName.replace(/\./g, "").toLowerCase();
  if (token && new RegExp(`(?<![a-z0-9])${escapeRegExp(token)}(?![a-z0-9])`).test(branchPlain)) return branchName;
  return `${degreeShort} ${branchName}`;
}
