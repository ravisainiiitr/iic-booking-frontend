import { format } from "date-fns";

/** Local calendar date "yyyy-MM-dd". `toISOString()` gives the UTC date, which is yesterday before 05:30 IST. */
export function localDateStamp(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/** Local date and time "yyyy-MM-ddTHH:mm" (minutes), for names and labels. */
export function localDateTimeStamp(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}
