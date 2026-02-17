import { describe, expect, it } from "bun:test";
import { layout } from "./layout.ts";

describe("layout feed discovery", () => {
  it("includes main RSS and Atom feed links", () => {
    const html = layout("<p>Hello</p>", "Hello");

    expect(html).toContain('<link rel="alternate" type="application/rss+xml" title="Sid\'s Blog" href="/posts/feed.xml">');
    expect(html).toContain('<link rel="alternate" type="application/atom+xml" title="Sid\'s Blog" href="/posts/feed.atom">');
  });

  it("includes tag-specific RSS and Atom links", () => {
    const html = layout("<p>Hello</p>", "Hello", undefined, "ai");

    expect(html).toContain('<link rel="alternate" type="application/rss+xml" title="Posts tagged ai" href="/tags/ai/feed.xml">');
    expect(html).toContain('<link rel="alternate" type="application/atom+xml" title="Posts tagged ai" href="/tags/ai/feed.atom">');
  });

  it("links footer feed navigation to /posts/feed", () => {
    const html = layout("<p>Hello</p>", "Hello");

    expect(html).toContain('<a href="/posts/feed" class="font-mono text-xs text-secondary">RSS/Atom Feed</a>');
  });
});
