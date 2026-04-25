import { getPostDateParts } from "../lib/post-date.ts";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function formatPostDate(dateStr: string): string {
  const parts = getPostDateParts(dateStr);
  if (!parts) {
    return dateStr;
  }

  const month = MONTHS[parts.month - 1] ?? String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}.${month}.${day}`;
}

export function formatPostMonthDay(dateStr: string): string {
  const parts = getPostDateParts(dateStr);
  if (!parts) {
    return dateStr;
  }

  const month = MONTHS[parts.month - 1] ?? String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${month}.${day}`;
}
