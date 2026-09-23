/**
 * Department options derived from an equipment list (internal_department on each row).
 */
export type EquipmentDeptOption = { id: number; name: string; code: string };

type EquipmentWithDept = {
  internal_department?: number | null;
  internal_department_name?: string | null;
  internal_department_code?: string | null;
};

export function deriveDepartmentsFromEquipments(rows: EquipmentWithDept[]): EquipmentDeptOption[] {
  const byId = new Map<number, EquipmentDeptOption>();
  for (const r of rows) {
    const id = r.internal_department;
    if (id == null || byId.has(Number(id))) continue;
    byId.set(Number(id), {
      id: Number(id),
      name: String(r.internal_department_name || `Department #${id}`),
      code: String(r.internal_department_code || ""),
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Prefer IIC (code "IIC" or name containing "instrumentation"), else the first department. */
export function pickDefaultDepartmentId(depts: EquipmentDeptOption[]): string {
  if (!depts.length) return "";
  const iic = depts.find(
    (d) =>
      String(d.code || "").toUpperCase() === "IIC" ||
      /instrumentation/i.test(String(d.name || ""))
  );
  return String((iic ?? depts[0]).id);
}

export function departmentLabel(d: EquipmentDeptOption): string {
  return d.code ? `${d.name} (${d.code})` : d.name;
}
