import { describe, expect, it } from "bun:test";
import { generateAtomFeed } from "./atom.ts";
import type { Post } from "./types.ts";

describe("generateAtomFeed", () => {
  const options = {
    title: "Sid's Blog",
    description: "Posts from Sid's blog",
    feedUrl: "https://sids.in/posts/feed.atom",
    siteUrl: "https://sids.in",
  };

  it("keeps local alternate links and includes related external URLs for link posts", () => {
    const post: Post = {
      title: "Deep Blue",
      slug: "deep-blue",
      date: "2026-02-16",
      description: "",
      tags: ["ai"],
      postType: "link",
      link: "https://example.com/article?foo=1&bar=2",
      draft: false,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    const feed = generateAtomFeed([post], options);

    expect(feed).toContain('<link rel="alternate" type="text/html" href="https://sids.in/posts/deep-blue" />');
    expect(feed).toContain('<link rel="related" type="text/html" href="https://example.com/article?foo=1&amp;bar=2" />');
    expect(feed).toContain("<id>https://sids.in/posts/deep-blue</id>");
    expect(feed).toContain('<a href="https://example.com/article?foo=1&amp;bar=2" target="_blank" rel="noopener noreferrer">Original link ↗</a>');
  });

  it("uses only alternate links for non-link posts", () => {
    const post: Post = {
      title: "Cognitive Debt",
      slug: "cognitive-debt",
      date: "2026-02-15",
      description: "",
      tags: ["ai"],
      postType: "aside",
      draft: false,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    const feed = generateAtomFeed([post], options);

    expect(feed).toContain('<link rel="alternate" type="text/html" href="https://sids.in/posts/cognitive-debt" />');
    expect(feed).not.toContain('rel="related"');
  });

  it("falls back safely when a post date is invalid", () => {
    const post: Post = {
      title: "Invalid Date",
      slug: "invalid-date",
      date: "not-a-date",
      description: "",
      tags: ["ai"],
      postType: "aside",
      draft: false,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    expect(() => generateAtomFeed([post], options)).not.toThrow();
  });
});
