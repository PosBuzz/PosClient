/**
 * Business days (sale numbers, "today" on the dashboard, EOD, daily targets)
 * are computed in the process's local time zone, which `src/timezone.ts` sets
 * from BUSINESS_TIMEZONE at boot. Sale timestamps are stored in UTC.
 */
export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Dhaka';

/** IANA name of the zone local-time Date methods use, for SQL `AT TIME ZONE`. */
export function businessTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** `YYYY-MM-DD` of the business-local calendar day containing `date`. */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
