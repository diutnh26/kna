/** Today's date in Vietnam (UTC+7), as YYYY-MM-DD — payment opens on the check-out date there. */
export function vnToday(now = new Date()) {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}
