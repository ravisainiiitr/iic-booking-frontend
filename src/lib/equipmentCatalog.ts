/** Catalog helpers for multi-mode parent/child equipment cards. */

export type CatalogEquipmentLike = {
  equipment_id: number;
  parent_equipment?: number | string | { equipment_id?: number } | null;
  enable_multi_mode?: boolean;
  /** From the catalog API: this instrument has child modes listed for the viewer (search ignored). */
  has_child_modes?: boolean;
};

/** Parse a catalog `dept` URL parameter ("all" or a department id); null when absent or invalid. */
export function catalogDepartmentFromParam(raw: string | null): "all" | number | null {
  if (raw === "all") return "all";
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Normalize API parent FK (id, numeric string, or nested object) to a number. */
export function catalogParentId(
  eq: Pick<CatalogEquipmentLike, "parent_equipment">,
): number | null {
  const raw = eq.parent_equipment;
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") {
    const nested = Number((raw as { equipment_id?: number }).equipment_id);
    return Number.isFinite(nested) ? nested : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Default catalog view: parents + standalone only (hide child modes).
 * When a parent id is expanded, include that parent and its children.
 * When search is active, show all API matches including child equipment.
 */
export function filterCatalogEquipmentForDisplay<T extends CatalogEquipmentLike>(
  list: T[],
  expandedParentId: number | null,
  options?: { searchActive?: boolean },
): T[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  const hasParentField = list.some(
    (eq) => catalogParentId(eq) != null || eq.enable_multi_mode === true,
  );
  if (!hasParentField) return list;

  // Search: API already filtered; show matching children as well as parents.
  if (options?.searchActive) {
    return list;
  }

  if (expandedParentId != null) {
    const parentId = Number(expandedParentId);
    return list.filter(
      (eq) =>
        Number(eq.equipment_id) === parentId || catalogParentId(eq) === parentId,
    );
  }

  return list.filter((eq) => catalogParentId(eq) == null);
}

export function isExpandableParent<T extends CatalogEquipmentLike>(
  list: T[],
  equipmentId: number,
): boolean {
  const id = Number(equipmentId);
  if (!Number.isFinite(id)) return false;
  return list.some((eq) => catalogParentId(eq) === id);
}

/**
 * True when this card should open a parent+child family view.
 * A multi-mode instrument with no child modes (e.g. NMR) opens its own page instead
 * of a one-card family view. A card picked from search results always opens the
 * equipment itself; the family view is only for browsing the catalog.
 */
export function isCatalogFamilyParent<T extends CatalogEquipmentLike>(
  list: T[],
  equipmentId: number,
  options?: { searchActive?: boolean },
): boolean {
  if (options?.searchActive) return false;
  const id = Number(equipmentId);
  if (!Number.isFinite(id)) return false;
  if (isExpandableParent(list, id)) return true;
  const self = list.find((eq) => Number(eq.equipment_id) === id);
  return self?.has_child_modes === true;
}