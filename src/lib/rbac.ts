/** Effective RBAC permission codes from current user payload. */

export function hasRbacPermission(
  user: { rbac_permissions?: string[] | null; user_type?: string | number | null } | null | undefined,
  code: string
): boolean {
  if (!user) return false;
  if (String(user.user_type ?? "").toLowerCase() === "admin") return true;
  const perms = user.rbac_permissions;
  if (!Array.isArray(perms)) return false;
  return perms.includes(code);
}

export function hasAnyRbacPermission(
  user: { rbac_permissions?: string[] | null; user_type?: string | number | null } | null | undefined,
  codes: string[]
): boolean {
  return codes.some((code) => hasRbacPermission(user, code));
}
