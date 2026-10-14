export type UnavailableCatalog = {
  id: string;
  name: string;
  state: "archived" | "disabled" | string;
};

export type SelectedSoftwareEntry = {
  id: string;
  label: string;
  /** Not an active catalog card: shown with a warning and ignored by allocation. */
  unavailable: boolean;
  note?: string;
};

export function shortCatalogId(id: string): string {
  return id.split("-")[0] || id.slice(0, 8);
}

/**
 * Every selected id gets a readable label, including ids whose catalog entry is archived/disabled
 * (named by the backend) or missing entirely, so each one can be shown with a Remove control.
 */
export function describeSelectedSoftware(
  ids: Iterable<string>,
  catalogs: { id: string; name: string }[],
  unavailable: UnavailableCatalog[] = []
): SelectedSoftwareEntry[] {
  const active = new Map(catalogs.map((c) => [c.id, c.name]));
  const hidden = new Map(unavailable.map((u) => [u.id, u]));
  return Array.from(ids).map((id) => {
    const name = active.get(id);
    if (name) return { id, label: name, unavailable: false };
    const known = hidden.get(id);
    if (known) {
      const where = known.state === "archived" ? "archived" : "disabled";
      return {
        id,
        label: known.name || `Software ${shortCatalogId(id)}`,
        unavailable: true,
        note: `${where} in the software catalog, not used for allocation`,
      };
    }
    return {
      id,
      label: "Unknown software (removed from catalog)",
      unavailable: true,
      note: `ID ${shortCatalogId(id)}…`,
    };
  });
}

/** The default must be an active catalog entry; unavailable ones are never allocatable. */
export function pickDefaultCatalogId(
  ids: Iterable<string>,
  catalogs: { id: string }[],
  current?: string | null
): string | null {
  const activeIds = new Set(catalogs.map((c) => c.id));
  const usable = Array.from(ids).filter((id) => activeIds.has(id));
  if (current && usable.includes(current)) return current;
  return usable[0] ?? null;
}
