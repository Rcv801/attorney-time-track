/**
 * Legal billing utilities
 * 
 * Attorneys bill in 0.1 hour increments (6 minutes).
 * 1-6 minutes = 0.1 hr, 7-12 minutes = 0.2 hr, etc.
 */

/**
 * Round time to 6-minute increments (0.1 hour)
 * Always rounds UP to ensure attorneys don't under-bill
 * Minimum billable unit is 0.1 hour (6 minutes)
 */
export function roundToSixMinutes(seconds: number): number {
  if (seconds <= 0) return 0;
  const minutes = seconds / 60;
  const tenths = Math.ceil(minutes / 6) / 10;
  return Math.max(tenths, 0.1);
}

/**
 * Format decimal hours as hours and minutes (e.g., "0.2 hr (12 min)")
 */
export function formatBillableHours(decimalHours: number): string {
  if (decimalHours <= 0) return "0.0 hr";
  const minutes = Math.round(decimalHours * 60);
  return `${decimalHours.toFixed(1)} hr (${minutes} min)`;
}

/**
 * Calculate billing amount based on time and rate
 * Uses 6-minute rounded time
 */
export function calculateBillingAmount(
  seconds: number,
  hourlyRate: number
): number {
  const billableHours = roundToSixMinutes(seconds);
  return billableHours * hourlyRate;
}

/**
 * Format seconds as HH:MM:SS for timer display
 */
export function formatDuration(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const hh = String(Math.floor(absSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((absSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(absSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Format seconds as a human-readable duration
 * e.g., "2h 15m" or "45m" or "5m 30s"
 */
export function formatDurationHuman(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const secs = absSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  return `${secs}s`;
}

/**
 * Get the effective hourly rate for a matter
 * Uses matter rate if set, otherwise falls back to client rate
 */
export function getEffectiveRate(
  matterRate: number | null | undefined,
  clientRate: number
): number {
  return matterRate ?? clientRate;
}
