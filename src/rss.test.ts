import { describe, expect, it } from "bun:test";
import { generateRssFeed } from "./rss.ts";
import type { Post } from "./types.ts";

describe("generateRssFeed", () => {
  const options = {
    title: "Sid's Blog",
    description: "Posts from Sid's blog",
    feedUrl: "https://sids.in/posts/feed.xml",
    siteUrl: "https://sids.in",
  };

  it("keeps local permalinks as item links for link posts", () => {
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

    const feed = generateRssFeed([post], options);

    expect(feed).toContain("<link>https://sids.in/posts/deep-blue</link>");
    expect(feed).toContain("<guid isPermaLink=\"true\">https://sids.in/posts/deep-blue</guid>");
    expect(feed).not.toContain("<source ");
    expect(feed).toContain('<a href="https://example.com/article?foo=1&amp;bar=2" target="_blank" rel="noopener noreferrer">Deep Blue ↗</a>');
  });

  it("keeps local permalinks for non-link posts", () => {
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

    const feed = generateRssFeed([post], options);

    expect(feed).toContain("<link>https://sids.in/posts/cognitive-debt</link>");
    expect(feed).toContain("<guid isPermaLink=\"true\">https://sids.in/posts/cognitive-debt</guid>");
  });
});
