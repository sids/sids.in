export function normalizeTag(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const tag = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return tag || null;
}

export function normalizeTags(input?: unknown): string[] {
  if (!input) {
    return [];
  }

  const values = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const tag = normalizeTag(value);
    if (!tag || seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}

export function tagHref(tag: string, suffix = ""): string {
  return `/tags/${encodeURIComponent(tag)}${suffix}`;
}
