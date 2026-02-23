import { describe, expect, it } from "bun:test";
import type { Post } from "../types.ts";
import { postTemplate } from "./post.ts";

describe("postTemplate", () => {
  it("renders link posts with a plain title and a top-of-content external link", () => {
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
    expect(html).not.toContain('<a href="https://example.com/article" class="text-primary"');
    expect(html).toContain('<p class="mb-6"><a href="https://example.com/article" target="_blank" rel="noopener noreferrer" class="underline">Deep Blue ↗</a></p>');
  });
});
