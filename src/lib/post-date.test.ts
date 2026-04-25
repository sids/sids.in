import { describe, expect, it } from "bun:test";
import { extractFrontmatterDate, getPostDateTimestamp, normalizePostDateForParsing, resolveFrontmatterDate } from "./post-date.ts";
import { formatPostDate } from "../templates/format-date.ts";

describe("post date helpers", () => {
  it("extracts frontmatter date values before YAML coerces timestamps", () => {
    const markdown = `---\ntitle: Test\ndate: 2026-04-25T09:03:29+05:30\n---\n`;

    expect(extractFrontmatterDate(markdown)).toBe("2026-04-25T09:03:29+05:30");
  });

  it("strips YAML inline comments when extracting frontmatter dates", () => {
    const markdown = `---\ntitle: Test\ndate: "2026-04-25T09:03:29Z" # published\n---\n`;

    expect(extractFrontmatterDate(markdown)).toBe("2026-04-25T09:03:29Z");
    expect(getPostDateTimestamp(extractFrontmatterDate(markdown))).toBe(Date.parse("2026-04-25T09:03:29.000Z"));
  });

  it("falls back to the parsed YAML date when raw extraction is invalid", () => {
    const markdown = `---\ntitle: Test\ndate: "not-a-date"\n---\n`;

    expect(resolveFrontmatterDate(markdown, new Date("2026-04-25T09:03:29Z"))).toBe("2026-04-25T09:03:29.000Z");
  });

  it("treats date-only frontmatter as midnight UTC", () => {
    expect(normalizePostDateForParsing("2026-04-25")).toBe("2026-04-25T00:00:00.000Z");
    expect(getPostDateTimestamp("2026-04-25")).toBe(Date.parse("2026-04-25T00:00:00.000Z"));
  });

  it("uses timestamp and offset when present", () => {
    expect(getPostDateTimestamp("2026-04-25T09:03:29+05:30")).toBe(
      Date.parse("2026-04-25T03:33:29.000Z"),
    );
  });

  it("formats the calendar date without showing the timestamp", () => {
    expect(formatPostDate("2026-04-25T00:30:00+05:30")).toBe("2026.APR.25");
  });
});
