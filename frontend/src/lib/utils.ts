/**
 * Shared utility functions — date formatting, helpers.
 */

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Get the day name for a 0-indexed day of week (0=Monday).
 */
export function getDayName(dayOfWeek: number, short = false): string {
  return short
    ? DAY_NAMES_SHORT[dayOfWeek] || ""
    : DAY_NAMES[dayOfWeek] || "";
}

/**
 * Format a date string to a readable format.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a datetime string to a readable format.
 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a time string "HH:MM:SS" to "h:mm a" (12-hour).
 */
export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Format a price in INR.
 */
export function formatPrice(price: number): string {
  return `₹${Number(price).toFixed(2)}`;
}

/**
 * Get today's day of week (0=Monday, 6=Sunday, matching our DB schema).
 */
export function getTodayWeekday(): number {
  const jsDay = new Date().getDay(); // 0=Sunday, 1=Monday, ...
  return jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Monday
}
