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
    expect(html).toContain('<p class="rss-source-link"><a href="https://example.com/article" target="_blank" rel="noopener noreferrer">Deep Blue ↗</a></p>');
    expect(html).not.toContain("Original link ↗");
    expect(html).toContain("<p>Body</p>");
  });

  it("embeds X posts for link posts that point to a status URL", () => {
    const post: Post = {
      title: "The Deal Is So Good",
      slug: "the-deal-is-so-good",
      date: "2026-03-09",
      description: "",
      tags: ["ai"],
      postType: "link",
      link: "https://x.com/atmoio/status/2030289138126107074?s=12",
      draft: false,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    const html = postTemplate(post, []);

    expect(html).toContain('class="twitter-tweet"');
    expect(html).toContain('https://twitter.com/atmoio/status/2030289138126107074');
    expect(html).toContain('https://platform.twitter.com/widgets.js');
    expect(html).toContain('window.twttr.widgets.load(root)');
    expect(html).toContain('data-tweet-embed-loader="true"');
  });

  it("does not embed non-status X links", () => {
    const post: Post = {
      title: "Profile Link",
      slug: "profile-link",
      date: "2026-03-09",
      description: "",
      tags: ["ai"],
      postType: "link",
      link: "https://x.com/sids",
      draft: false,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    const html = postTemplate(post, []);

    expect(html).not.toContain('class="twitter-tweet"');
    expect(html).not.toContain('https://platform.twitter.com/widgets.js');
  });

  it("preserves the current post URL in the draft login link", () => {
    const post: Post = {
      title: "Draft Post",
      slug: "draft-post",
      date: "2026-03-09",
      description: "",
      tags: ["ai"],
      postType: "note",
      draft: true,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    const html = postTemplate(post, [], "all", false, "/posts/draft-post?tag=ai");

    expect(html).toContain('href="/admin/login?returnTo=%2Fposts%2Fdraft-post%3Ftag%3Dai"');
  });
});
