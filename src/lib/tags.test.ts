import { describe, it, expect } from "bun:test";
import { normalizeTag, normalizeTags, tagHref } from "./tags.ts";

describe("tag helpers", () => {
  it("normalizes tags to URL-safe slugs", () => {
    expect(normalizeTag('AI Coding')).toBe("ai-coding");
    expect(normalizeTag('x" onmouseover="alert(1)')).toBe("x-onmouseover-alert-1");
  });

  it("deduplicates normalized tags", () => {
    expect(normalizeTags(["AI", "ai", "AI!"])).toEqual(["ai"]);
  });

  it("URL-encodes tag links defensively", () => {
    expect(tagHref('x" onmouseover="alert(1)', "/feed.xml")).toBe('/tags/x%22%20onmouseover%3D%22alert(1)/feed.xml');
  });
});
