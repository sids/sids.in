import { describe, expect, it } from "bun:test";
import { feedTemplate, tagFeedTemplate } from "./feed.ts";

describe("feed templates", () => {
  it("renders Atom and RSS links for the global feed page", () => {
    const html = feedTemplate();

    expect(html).toContain('/posts/feed.atom');
    expect(html).toContain('/posts/feed.xml');
  });

  it("renders tag-specific Atom/RSS links and global feed page link", () => {
    const html = tagFeedTemplate("ai");

    expect(html).toContain('/tags/ai/feed.atom');
    expect(html).toContain('/tags/ai/feed.xml');
    expect(html).toContain('/posts/feed');
  });
});
