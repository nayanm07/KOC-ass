import { format, formatDistanceToNowStrict, isValid } from "date-fns";

/**
 * Dates are stored as UTC (timestamptz) and rendered in the viewer's local timezone,
 * using the platform-wide DD/MM/YYYY format.
 */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isValid(d) ? format(d, "dd/MM/yyyy") : "—";
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isValid(d) ? format(d, "dd/MM/yyyy, HH:mm") : "—";
}

export function fromNow(iso: string): string {
  const d = new Date(iso);
  if (!isValid(d)) return "";
  const rel = formatDistanceToNowStrict(d, { addSuffix: true });
  return rel;
}

/** ISO → value for <input type="datetime-local"> (local time, no seconds) */
export function toDateTimeLocal(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

/** <input type="datetime-local"> value (local time) → ISO UTC string for the API */
export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
}

/** Short timezone name of the viewer, e.g. "GMT+5:30" — shown next to date inputs */
export function localTimezoneLabel(): string {
  const part = new Intl.DateTimeFormat("en", { timeZoneName: "short" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}
