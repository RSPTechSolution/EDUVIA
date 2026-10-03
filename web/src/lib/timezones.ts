/** IANA time zones for pickers. Browsers differ (Chrome lists India as "Asia/Calcutta"),
 *  so common zones are added explicitly and the current value is always included. */
const COMMON = ["Asia/Kolkata", "Asia/Dubai", "Asia/Kathmandu", "Asia/Dhaka", "Asia/Singapore", "Europe/London", "America/New_York"];

export function timeZoneOptions(current?: string): string[] {
  let list: string[] = [];
  try {
    list = Intl.supportedValuesOf("timeZone");
  } catch {
    /* very old browsers */
  }
  return Array.from(new Set([...(current ? [current] : []), ...COMMON, ...list])).sort();
}

export const tzLabel = (tz: string) => tz.replace(/_/g, " ");
