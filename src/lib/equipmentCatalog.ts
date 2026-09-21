/** Catalog helpers for multi-mode parent/child equipment cards. */

export type CatalogEquipmentLike = {
  equipment_id: number;
  parent_equipment?: number | string | { equipment_id?: number } | null;
  enable_multi_mode?: boolean;
};

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
 */
export function filterCatalogEquipmentForDisplay<T extends CatalogEquipmentLike>(
  list: T[],
  expandedParentId: number | null,
): T[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  const hasParentField = list.some(
    (eq) => catalogParentId(eq) != null || eq.enable_multi_mode === true,
  );
  if (!hasParentField) return list;

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