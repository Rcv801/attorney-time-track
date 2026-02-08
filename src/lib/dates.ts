import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Returns the user's time zone.
 * @returns {string} The user's IANA time zone name (e.g., "America/New_York").
 */
export function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Converts a date from the local time zone to a UTC Date object.
 * @param {Date | string | number} date - The local date to convert.
 * @returns {Date} The converted date in UTC.
 */
export function localToUtc(date: Date | string | number): Date {
  const timeZone = getUserTimeZone();
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return fromZonedTime(dateObj, timeZone);
}

/**
 * Converts a UTC date to a Date object in the user's local time zone.
 * @param {Date | string | number} utcDate - The UTC date to convert.
 * @returns {Date} The date in the user's local time zone.
 */
export function utcToLocal(utcDate: Date | string | number): Date {
  const timeZone = getUserTimeZone();
  const dateObj = typeof utcDate === 'string' || typeof utcDate === 'number' ? new Date(utcDate) : utcDate;
  return toZonedTime(dateObj, timeZone);
}

/**
 * Gets the start of the day for a given date in the user's local time zone,
 * and returns it as a UTC Date object.
 * This is useful for querying records created "today" local time from a UTC database.
 * @param {Date} [date=new Date()] - The date to get the start of. Defaults to now.
 * @returns {Date} The start of the local day, converted to a UTC Date object.
 */
export function startOfLocalDayUtc(date: Date = new Date()): Date {
    const timeZone = getUserTimeZone();
    // Get the start of the day in the local time zone
    const localStartOfDay = startOfDay(date);
    // Convert that local start of day to its UTC equivalent
    return fromZonedTime(localStartOfDay, timeZone);
}

/**
 * Gets the end of the day for a given date in the user's local time zone,
 * and returns it as a UTC Date object.
 * @param {Date} [date=new Date()] - The date to get the end of. Defaults to now.
 * @returns {Date} The end of the local day, converted to a UTC Date object.
 */
export function endOfLocalDayUtc(date: Date = new Date()): Date {
    const timeZone = getUserTimeZone();
    const localEndOfDay = endOfDay(date);
    return fromZonedTime(localEndOfDay, timeZone);
}

/**
 * Converts a date to an ISO 8601 string in UTC ('Z' timezone).
 * Handles Date objects and ISO date strings.
 * If the input is already a string, it's assumed to be in UTC.
 * If the input is a Date object, it's converted to a UTC ISO string.
 * @param {Date | string | null | undefined} date - The date to convert.
 * @returns {string | undefined} The ISO 8601 string in UTC, or undefined if input is null/undefined.
 */
export function toISO(date: Date | string | null | undefined): string | undefined {
    if (!date) return undefined;
    if (typeof date === 'string') {
        // If it's already a string, ensure it's in the correct format or return as is
        // We can parse and re-format to be safe, assuming it's a UTC string
        return parseISO(date).toISOString();
    }
    return date.toISOString();
}
