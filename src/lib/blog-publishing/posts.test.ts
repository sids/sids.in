import { describe, expect, it } from "bun:test";
import fm from "front-matter";
import {
  PublishingValidationError,
  formatIstDateTime,
  preparePostDraft,
  publishDraftMarkdown,
} from "./posts.ts";

describe("post draft preparation", () => {
  const now = new Date("2026-07-23T12:34:56.789Z");

  it("serializes a note with stable draft frontmatter and IST time", () => {
    const prepared = preparePostDraft({
      kind: "note",
      title: "A Note: \"Quoted\"",
      tags: ["AI", "ai", "Product Building"],
      content: "Sid's exact words.",
    }, { now });

    expect(prepared.date).toBe("2026-07-23T18:04:56.789+05:30");
    expect(prepared.path).toBe("content/posts/2026/07-23-a-note-quoted.md");
    const parsed = fm<{
      title: string;
      description: string;
      tags: string[];
      draft: boolean;
      link?: string;
    }>(prepared.markdown);
    expect(parsed.attributes).toMatchObject({
      title: "A Note: \"Quoted\"",
      description: "",
      tags: ["ai", "product-building"],
      draft: true,
    });
    expect(parsed.attributes.link).toBeUndefined();
    expect(parsed.body.trim()).toBe("Sid's exact words.");
  });

  it("requires and normalizes a public HTTP-shaped link URL", () => {
    const prepared = preparePostDraft({
      kind: "link",
      title: "Linked",
      link: " https://example.com/article ",
      description: "",
      tags: "AI",
      content: "Commentary",
    }, { now });

    expect(prepared.link).toBe("https://example.com/article");
    expect(prepared.markdown).toContain('link: "https://example.com/article"');
    expect(prepared.markdown).toContain("draft: true");
  });

  it("creates articles in the article directory as drafts", () => {
    const prepared = preparePostDraft({
      kind: "article",
      title: "A Longer Essay",
      content: "Body",
    }, { now });

    expect(prepared.path).toBe("content/posts/articles/2026-07-a-longer-essay.md");
    expect(prepared.markdown).toContain("draft: true");
  });

  it("quotes multiline YAML values without permitting frontmatter injection", () => {
    const prepared = preparePostDraft({
      kind: "note",
      title: "Title\nInjected: true",
      description: "Description\nDraft: false",
      content: "Body",
    }, { now });
    const parsed = fm<{ title: string; description: string; draft: boolean }>(prepared.markdown);

    expect(parsed.attributes.title).toBe("Title\nInjected: true");
    expect(parsed.attributes.description).toBe("Description\nDraft: false");
    expect(parsed.attributes.draft).toBe(true);
    expect(prepared.markdown).not.toContain("\nInjected: true\n");
  });

  it("round-trips Unicode frontmatter and body text", () => {
    const prepared = preparePostDraft({
      kind: "note",
      title: "Café notes ☕",
      description: "Résumé — 日本語",
      content: "Exact emoji: 🫶🏽",
    }, { now });
    const parsed = fm<{ title: string; description: string }>(prepared.markdown);

    expect(parsed.attributes.title).toBe("Café notes ☕");
    expect(parsed.attributes.description).toBe("Résumé — 日本語");
    expect(parsed.body).toContain("Exact emoji: 🫶🏽");
  });

  it("preserves leading Markdown indentation and existing trailing newlines", () => {
    const content = "    const exact = true;\n\nTrailing paragraph.\n";
    const prepared = preparePostDraft({
      kind: "note",
      title: "Whitespace",
      content,
    }, { now });

    expect(prepared.content).toBe(content);
    expect(prepared.markdown).toEndWith(`---\n\n${content}`);
  });

  it("rejects missing titles, unusable slugs, and invalid link schemes", () => {
    expect(() => preparePostDraft({ kind: "note", title: "", content: "" }, { now }))
      .toThrow(PublishingValidationError);
    expect(() => preparePostDraft({ kind: "note", title: "💬✨", content: "" }, { now }))
      .toThrow("Title must contain letters or numbers");
    expect(() => preparePostDraft({
      kind: "link",
      title: "Unsafe",
      link: "javascript:alert(1)",
      content: "",
    }, { now })).toThrow("Invalid URL");
  });
});

describe("publication helpers", () => {
  it("formats IST timestamps across a UTC date boundary", () => {
    expect(formatIstDateTime(new Date("2026-07-23T21:00:00.000Z")))
      .toBe("2026-07-24T02:30:00.000+05:30");
  });

  it("rejects invalid publication dates", () => {
    expect(() => formatIstDateTime(new Date("not-a-date"))).toThrow("Invalid post date");
  });

  it("publishes only draft frontmatter and replaces the date", () => {
    const raw = "---\ntitle: \"Draft\"\nslug: \"draft\"\ndate: \"2026-01-01\"\ndraft: true\n---\n\nBody\n";
    const result = publishDraftMarkdown(raw, "2026-07-23T18:04:56.789+05:30");

    expect(result).toContain('date: "2026-07-23T18:04:56.789+05:30"');
    expect(result).toContain("draft: false");
    expect(result).not.toContain("draft: true");
  });
});
