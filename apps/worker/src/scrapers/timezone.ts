const PACIFIC = "America/Los_Angeles";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Creates a Date representing a specific local time in America/Los_Angeles.
 *
 * Unlike `new Date(y, m, d, h, m)` which uses the system timezone (UTC on
 * most servers), this correctly produces the UTC instant for a given Pacific
 * wall-clock time, handling PST/PDT transitions automatically.
 */
export function pacificDate(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
): Date {
  // Start with a UTC date using the same numeric components
  const utcGuess = new Date(Date.UTC(year, month, day, hours, minutes));

  // Format this UTC instant in Pacific time to discover the offset
  const parts = fmt.formatToParts(utcGuess);
  const get = (type: string) => {
    const v = parseInt(parts.find((p) => p.type === type)!.value);
    return type === "hour" && v === 24 ? 0 : v;
  };

  const pacMinutes = get("hour") * 60 + get("minute");
  const wantMinutes = hours * 60 + minutes;

  let pacDay = get("day");
  let dayDiff = day - pacDay;
  // Handle month-boundary wrapping
  if (dayDiff > 15) dayDiff -= new Date(year, month + 1, 0).getDate();
  if (dayDiff < -15) dayDiff += new Date(year, month + 1, 0).getDate();

  const totalOffsetMs = ((wantMinutes - pacMinutes) + dayDiff * 24 * 60) * 60_000;
  return new Date(utcGuess.getTime() + totalOffsetMs);
}
