// ==============================================================================
// dateUtils.ts - Consistent Gregorian Arabic Date Formatting
// ==============================================================================

/**
 * Formats any date (ISO string, timestamp, Date) into a consistent Gregorian
 * Arabic format (e.g., '23 أكتوبر 2026' or '23 أكتوبر 2026 - 10:18 ص').
 * Always forces the Gregorian calendar ('gregory') to prevent unexpected Hijri switching.
 */
export function formatDateAr(
  dateVal: string | Date | number | null | undefined,
  includeTime = false
): string {
  if (!dateVal) return '-';
  try {
    const d = typeof dateVal === 'object' ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);

    if (includeTime) {
      return new Intl.DateTimeFormat('ar-EG', {
        calendar: 'gregory',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(d);
    }

    return new Intl.DateTimeFormat('ar-EG', {
      calendar: 'gregory',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(d);
  } catch {
    return String(dateVal);
  }
}

/**
 * Simple numeric Gregorian date: YYYY/MM/DD
 */
export function formatDateNumeric(dateVal: string | Date | number | null | undefined): string {
  if (!dateVal) return '-';
  try {
    const d = typeof dateVal === 'object' ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  } catch {
    return String(dateVal);
  }
}

/**
 * Returns current timestamp in ISO 8601 string.
 */
export function nowIso(): string {
  return new Date().toISOString();
}
