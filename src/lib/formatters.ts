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
 * Parse a Geotab duration value to fractional hours.
 * Geotab returns durations as ISO 8601 strings like "01:23:45" (HH:MM:SS)
 * or sometimes "1.01:23:45" (D.HH:MM:SS), or as a plain seconds number.
 */
export function parseDurationToHours(duration: string | number | null | undefined): number {
  if (duration == null) return 0;

  if (typeof duration === "number") return duration / 3600;

  const str = String(duration);

  // Try "D.HH:MM:SS" or "HH:MM:SS"
  const dotParts = str.split(".");
  let days = 0;
  let timePart = str;
  if (dotParts.length === 2 && dotParts[0].indexOf(":") === -1) {
    days = parseInt(dotParts[0], 10) || 0;
    timePart = dotParts[1];
  }

  const colonParts = timePart.split(":");
  if (colonParts.length >= 2) {
    const h = parseInt(colonParts[0], 10) || 0;
    const m = parseInt(colonParts[1], 10) || 0;
    const s = colonParts.length >= 3 ? (parseInt(colonParts[2], 10) || 0) : 0;
    return days * 24 + h + m / 60 + s / 3600;
  }

  // Plain number as string (seconds)
  const num = parseFloat(str);
  if (!isNaN(num)) return num / 3600;

  return 0;
}
