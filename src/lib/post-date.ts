export type PostDateValue = string | Date | number | null | undefined;

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

export interface PostDateParts {
  year: number;
  month: number;
  day: number;
}

export function extractFrontmatterDate(rawMarkdown: string): string | null {
  const frontmatterMatch = rawMarkdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const dateLineMatch = frontmatterMatch[1]!.match(/^date:\s*(.*?)\s*$/m);
  if (!dateLineMatch) {
    return null;
  }

  return parseYamlScalar(dateLineMatch[1]!);
}

export function postDateValueToString(value: PostDateValue): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

export function resolveFrontmatterDate(rawMarkdown: string, parsedDate: PostDateValue): string {
  const rawDate = extractFrontmatterDate(rawMarkdown);
  if (rawDate === null || (rawDate !== "" && !getPostDate(rawDate))) {
    return postDateValueToString(parsedDate);
  }

  return rawDate;
}

export function normalizePostDateForParsing(value: PostDateValue): string {
  const dateStr = postDateValueToString(value);
  if (!dateStr) {
    return "";
  }

  if (DATE_ONLY_RE.test(dateStr)) {
    return `${dateStr}T00:00:00.000Z`;
  }

  const match = dateStr.match(DATE_TIME_RE);
  if (!match) {
    return dateStr;
  }

  const datePart = match[1]!;
  const hour = match[2]!;
  const minute = match[3]!;
  const second = match[4] ?? "00";
  const fraction = match[5] ?? "";
  const rawTimeZone = match[6];
  const timeZone = rawTimeZone ? normalizeTimeZone(rawTimeZone) : "Z";
  return `${datePart}T${hour}:${minute}:${second}${fraction}${timeZone}`;
}

export function getPostDate(value: PostDateValue): Date | null {
  const normalized = normalizePostDateForParsing(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function getPostDateTimestamp(value: PostDateValue): number {
  return getPostDate(value)?.getTime() ?? 0;
}

export function getPostDateParts(value: PostDateValue): PostDateParts | null {
  const dateStr = postDateValueToString(value);
  const prefixMatch = dateStr.match(DATE_PREFIX_RE);
  if (prefixMatch) {
    return {
      year: Number(prefixMatch[1]!),
      month: Number(prefixMatch[2]!),
      day: Number(prefixMatch[3]!),
    };
  }

  const date = getPostDate(value);
  if (!date) {
    return null;
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function parseYamlScalar(rawValue: string): string {
  const value = stripYamlInlineComment(rawValue).trim();
  if (!value) {
    return "";
  }

  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }

  return value;
}

function stripYamlInlineComment(value: string): string {
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let i = 0; i < value.length; i++) {
    const char = value[i]!;

    if (quote) {
      if (quote === '"' && char === "\\" && !escaped) {
        escaped = true;
        continue;
      }

      if (char === quote && !escaped) {
        quote = null;
      }

      escaped = false;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "#" && (i === 0 || /\s/.test(value[i - 1]!))) {
      return value.slice(0, i);
    }
  }

  return value;
}

function normalizeTimeZone(timeZone: string): string {
  if (timeZone.toUpperCase() === "Z") {
    return "Z";
  }

  const compactMatch = timeZone.match(/^([+-]\d{2})(\d{2})$/);
  if (compactMatch) {
    return `${compactMatch[1]!}:${compactMatch[2]!}`;
  }

  return timeZone;
}
