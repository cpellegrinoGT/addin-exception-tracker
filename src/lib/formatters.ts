/** Convert fractional hours to "Xh Ym" display */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours)) return "--";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0 && m === 0) return "0h";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format a percentage with one decimal */
export function formatPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  return n.toFixed(1) + "%";
}

/**
 * Parse a Geotab duration/TimeSpan value to fractional hours.
 *
 * Geotab formats:
 *   "HH:MM:SS"                  e.g. "01:23:45"
 *   "HH:MM:SS.fffffff"          e.g. "00:05:30.0000000"
 *   "D.HH:MM:SS"                e.g. "1.02:03:04"
 *   "D.HH:MM:SS.fffffff"        e.g. "1.02:03:04.0000000"
 *   plain number (seconds)
 */
export function parseDurationToHours(duration: string | number | null | undefined): number {
  if (duration == null) return 0;

  if (typeof duration === "number") return duration / 3600;

  const str = String(duration).trim();
  if (!str) return 0;

  // Match optional "D." prefix, then HH:MM:SS with optional ".fractional"
  const match = str.match(/^(?:(\d+)\.)?(\d+):(\d+):(\d+)(?:\.\d+)?$/);
  if (match) {
    const days = match[1] ? parseInt(match[1], 10) : 0;
    const h = parseInt(match[2], 10);
    const m = parseInt(match[3], 10);
    const s = parseInt(match[4], 10);
    return days * 24 + h + m / 60 + s / 3600;
  }

  // Plain number as string (seconds)
  const num = parseFloat(str);
  if (!isNaN(num)) return num / 3600;

  return 0;
}
