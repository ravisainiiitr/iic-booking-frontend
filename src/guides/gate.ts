import type { GuideAudienceId, GuideContext, GuideFeatureFlags, GuideSection } from "./types";

/** One role's guide: chapters are built per user so only relevant items remain. */
export interface RoleGuide {
  title: string;
  welcome: string;
  sections: (g: Gate) => GuideSection[];
}

/** Roles that book equipment for themselves. */
export const BOOKERS: GuideAudienceId[] = ["student", "project_staff", "faculty", "startup", "external"];
/** Book against a supervisor's / PI's wallet. */
export const WALLET_MEMBERS: GuideAudienceId[] = ["student", "project_staff"];
/** Hold their own wallet. */
export const WALLET_OWNERS: GuideAudienceId[] = ["faculty", "startup", "external"];
/** Internal users covered by the Type A / Type B urgent booking policy. */
export const URGENT_BOOKERS: GuideAudienceId[] = ["student", "project_staff", "faculty"];

export interface Gate {
  audience: GuideAudienceId;
  flags: GuideFeatureFlags;
  is: (...roles: GuideAudienceId[]) => boolean;
  /** `value` for the listed roles, otherwise null (removed by `compact`). */
  only: <T>(roles: GuideAudienceId[], value: T) => T | null;
  /** `value` when `cond` holds, otherwise null. */
  when: <T>(cond: boolean, value: T) => T | null;
  /** First matching value; `fallback` when no role matches. */
  pick: <T>(byRole: Partial<Record<GuideAudienceId, T>>, fallback: T) => T;
}

export function gate(ctx: GuideContext): Gate {
  const is = (...roles: GuideAudienceId[]) => roles.includes(ctx.audience);
  return {
    audience: ctx.audience,
    flags: ctx.flags,
    is,
    only: (roles, value) => (is(...roles) ? value : null),
    when: (cond, value) => (cond ? value : null),
    pick: (byRole, fallback) => byRole[ctx.audience] ?? fallback,
  };
}

export function compact<T>(items: ReadonlyArray<T | null | undefined | false>): T[] {
  return items.filter((x): x is T => x != null && x !== false);
}
