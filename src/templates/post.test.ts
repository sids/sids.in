import { describe, expect, it } from "bun:test";
import type { Post } from "../types.ts";
import { postTemplate } from "./post.ts";

describe("postTemplate", () => {
  it("renders link post titles as external h1 links with a text arrow marker", () => {
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

    const html = postTemplate(post, []);

    expect(html).toContain("<h1");
    expect(html).toContain('<span aria-hidden="true">↗ </span><a href="https://example.com/article" target="_blank" rel="noopener noreferrer" class="text-primary">Deep Blue</a>');
    expect(html).toContain('<p class="rss-link-only"><a href="https://example.com/article" target="_blank" rel="noopener noreferrer">Deep Blue ↗</a></p>');
    expect(html).not.toContain("Original link ↗");
    expect(html).toContain("<p>Body</p>");
  });
});
