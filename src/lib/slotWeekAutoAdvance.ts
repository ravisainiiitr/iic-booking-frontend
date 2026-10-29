/**
 * Which week the booking calendar opens on: the first bookable week (from the current week) that still
 * has a slot this user can book. Weeks are loaded one at a time, so the page checks the week on screen and
 * asks for the next step.
 */
export type AutoWeekStep =
  /** Keep checking: show this week next. */
  | { done: false; showIndex: number }
  /** Stop: show this week (`advanced` when it is not the week the check started on). */
  | { done: true; showIndex: number; advanced: boolean };

export function nextAutoWeekStep(opts: {
  /** Index of the week on screen in the weeks the user may book. */
  index: number;
  /** Index the check started on (the current week). */
  startIndex: number;
  weekCount: number;
  hasBookableSlot: boolean;
}): AutoWeekStep {
  const { index, startIndex, weekCount, hasBookableSlot } = opts;
  if (hasBookableSlot) return { done: true, showIndex: index, advanced: index !== startIndex };
  if (index + 1 < weekCount) return { done: false, showIndex: index + 1 };
  // Nothing free in any open week. Once next week has opened (Wednesday 21:00 for internal users), land on it even
  // if it is full too: the current week is over for this user. Before that, stay on the current week, which
  // explains when the next slots open.
  if (startIndex + 1 < weekCount) return { done: true, showIndex: startIndex + 1, advanced: true };
  return { done: true, showIndex: startIndex, advanced: false };
}
