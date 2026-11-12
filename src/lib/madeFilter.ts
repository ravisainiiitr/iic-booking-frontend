const madeDayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/** Chip text for the "made on" filter: "Made today", "Made on 3 Nov 2026", "Made 1 Nov 2026 – 9 Nov 2026". */
export function madeFilterLabel(from: string, to: string, today: string = istToday()): string {
  const day = (iso: string) => madeDayFormat.format(new Date(`${iso}T12:00:00+05:30`));
  if (from && from === to) return from === today ? "Made today" : `Made on ${day(from)}`;
  if (from && to) return `Made ${day(from)} – ${day(to)}`;
  if (from) return `Made since ${day(from)}`;
  return `Made until ${day(to)}`;
}
