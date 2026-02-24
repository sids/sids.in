import { describe, expect, it } from "bun:test";
import type { Post } from "../../types.ts";
import { postCard } from "./post-card.ts";

describe("postCard", () => {
  it("renders link post titles with a text arrow marker instead of svg icon", () => {
    const post: Post = {
      title: "Deep Blue",
      slug: "deep-blue",
      date: "2026-02-16",
      description: "",
      tags: ["ai"],
      postType: "link",
      link: "https://example.com/article",
      draft: false,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    const html = postCard(post);

    expect(html).toContain('href="https://example.com/article"');
    expect(html).toContain('class="link-accent date-mono inline-flex items-center gap-1 mb-2"');
    expect(html).toContain("2026.FEB.16");
    expect(html).toContain('class="inline-block h-3.5 w-3.5 align-middle"');
    expect(html).toContain('<span aria-hidden="true">↗ </span><a href="https://example.com/article" class="text-primary" target="_blank" rel="noopener noreferrer">Deep Blue</a>');
    expect(html).not.toContain('<svg class="inline-block w-5 h-5 mr-1 align-middle"');
  });
});
