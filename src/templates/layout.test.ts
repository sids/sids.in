import { describe, expect, it } from "bun:test";
import { layout } from "./layout.ts";

describe("layout feed discovery", () => {
  it("preloads self-hosted fonts", () => {
    const html = layout("<p>Hello</p>", "Hello");

    expect(html).toMatch(/<link rel="preload" href="\/fonts\/overpass-latin\.woff2(?:\?v=[a-f0-9]+)?" as="font" type="font\/woff2" crossorigin>/);
    expect(html).toMatch(/<link rel="preload" href="\/fonts\/overpass-mono-latin\.woff2(?:\?v=[a-f0-9]+)?" as="font" type="font\/woff2" crossorigin>/);
  });

  it("loads local deferred HTMX scripts", () => {
    const html = layout("<p>Hello</p>", "Hello");

    expect(html).toMatch(/<script defer src="\/js\/htmx-2\.0\.4\.min\.js(?:\?v=[a-f0-9]+)?"><\/script>/);
    expect(html).toMatch(/<script defer src="\/js\/htmx-head-support-2\.0\.2\.js(?:\?v=[a-f0-9]+)?"><\/script>/);
    expect(html).not.toContain("unpkg.com");
  });

  it("uses the optimized logo image with explicit dimensions", () => {
    const html = layout("<p>Hello</p>", "Hello");

    expect(html).toMatch(/<img src="\/images\/s-40\.webp(?:\?v=[a-f0-9]+)?" width="20" height="20" alt="" class="w-5 h-5 rounded">/);
  });

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
