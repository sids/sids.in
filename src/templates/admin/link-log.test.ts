import { describe, it, expect } from "bun:test";
import { linkLogTemplate } from "./link-log.ts";

describe("linkLogTemplate", () => {
  const origin = "https://example.com";
  const tags = [{ tag: "tech", count: 5 }, { tag: "web", count: 3 }];

  it("generates bookmarklet copy button", () => {
    const html = linkLogTemplate(origin, tags);
    expect(html).toContain('id="bookmarklet-copy"');
    expect(html).toContain("Copy bookmarklet");
  });

  it("uses Clipboard API with writeText", () => {
    const html = linkLogTemplate(origin, tags);
    expect(html).toContain("navigator.clipboard.writeText");
  });

  it("includes fallback copy using execCommand", () => {
    const html = linkLogTemplate(origin, tags);
    expect(html).toContain("document.execCommand('copy')");
  });

  it("generates bookmarklet with correct origin", () => {
    const html = linkLogTemplate(origin, tags);
    expect(html).toContain("javascript:");
    expect(html).toContain(origin);
  });

  it("includes tag options in script", () => {
    const html = linkLogTemplate(origin, tags);
    expect(html).toContain('"tech"');
    expect(html).toContain('"web"');
  });

  it("escapes special characters in tags", () => {
    const tagsWithSpecial = [{ tag: "<script>", count: 1 }];
    const html = linkLogTemplate(origin, tagsWithSpecial);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('"<script>"');
  });

  it("parses selection with escaped newline regex", () => {
    const html = linkLogTemplate(origin, tags);
    expect(html).toContain("selection.split(/\\r?\\n/)");
    expect(html).toContain(".join('\\n')");
  });
});
