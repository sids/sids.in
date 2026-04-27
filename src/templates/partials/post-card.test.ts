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

  it("does not render unsafe link schemes", () => {
    const post: Post = {
      title: "Unsafe Link",
      slug: "unsafe-link",
      date: "2026-04-26",
      description: "Description",
      tags: [],
      postType: "link",
      link: "javascript:alert(1)",
      draft: false,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    const html = postCard(post);

    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).toContain('href="/posts/unsafe-link"');
  });

  it("embeds X posts for link cards that point to a status URL", () => {
    const post: Post = {
      title: "Multi-Agents: What's Actually Working",
      slug: "multi-agents-whats-actually-working",
      date: "2026-04-25",
      description: "",
      tags: ["agentic-engineering"],
      postType: "link",
      link: "https://x.com/walden_yan/status/2047054401341370639",
      draft: false,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    const html = postCard(post);

    expect(html).toContain('class="twitter-tweet"');
    expect(html).toContain('https://twitter.com/walden_yan/status/2047054401341370639');
    expect(html).toContain('window.twttr.widgets.load(root)');
  });

  it("URL-encodes tag links", () => {
    const post: Post = {
      title: "Tagged Post",
      slug: "tagged-post",
      date: "2026-04-26",
      description: "Description",
      tags: ['x" onmouseover="alert(1)'],
      postType: "note",
      draft: false,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    const html = postCard(post);

    expect(html).toContain('href="/tags/x%22%20onmouseover%3D%22alert(1)"');
    expect(html).not.toContain('href="/tags/x" onmouseover=');
  });

  it("embeds YouTube videos for link cards that point to a video URL", () => {
    const post: Post = {
      title: "You and Your Research",
      slug: "you-and-your-research",
      date: "2026-04-26",
      description: "",
      tags: ["excellence"],
      postType: "link",
      link: "https://youtu.be/a1zDuOPkMSw?t=42",
      draft: false,
      html: "<p>Body</p>",
      excerpt: "Body",
    };

    const html = postCard(post);

    expect(html).toContain('class="youtube-embed my-8 not-prose"');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/a1zDuOPkMSw?start=42"');
    expect(html).toContain('<div class="post-content"><div class="youtube-embed');
  });
});
