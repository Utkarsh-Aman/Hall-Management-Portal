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
 * Parse an API date string safely as UTC if it doesn't have timezone info.
 */
export function parseApiDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes("T") && !dateStr.endsWith("Z")) {
    return new Date(dateStr + "Z");
  }
  return new Date(dateStr);
}

/**
 * Format a date string to a readable format.
 */
export function formatDate(dateStr: string): string {
  const date = parseApiDate(dateStr);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a datetime string to a readable format.
 */
export function formatDateTime(dateStr: string): string {
  const date = parseApiDate(dateStr);
  return date.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a time string "HH:MM:SS" or ISO datetime string to "h:mm a" (12-hour).
 */
export function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  
  let hours, minutes;
  if (timeStr.includes("T")) {
    const d = parseApiDate(timeStr);
    hours = d.getHours();
    minutes = d.getMinutes();
  } else {
    const parts = timeStr.split(":");
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
  }
  
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
