import { describe, expect, it } from "bun:test";
import { adminHomeTemplate } from "./home.ts";
import type { PostMeta } from "../../types.ts";

function draftPost(overrides: Partial<PostMeta> = {}): PostMeta {
  return {
    title: "Draft Post",
    slug: "draft-post",
    date: "2026-04-25T09:03:29+05:30",
    tags: [],
    draft: true,
    sourcePath: "content/posts/2026/draft-post.md",
    postType: "article",
    ...overrides,
  };
}

describe("adminHomeTemplate", () => {
  it("renders draft posts with escaped titles, preview links, formatted dates, and labels", () => {
    const html = adminHomeTemplate([
      draftPost({
        title: "Draft <Post> & \"Quote\"",
        slug: "draft-post",
        sourcePath: "content/posts/2026/draft-<post>.md",
        postType: "link",
      }),
    ]);

    expect(html).toContain("Draft posts");
    expect(html).toContain('href="/posts/draft-post"');
    expect(html).toContain("Draft &lt;Post&gt; &amp; &quot;Quote&quot;");
    expect(html).not.toContain("Draft <Post>");
    expect(html).toContain("2026.APR.25");
    expect(html).toContain("Link log");
    expect(html).toContain("content/posts/2026/draft-&lt;post&gt;.md");
  });

  it("renders the empty state when no drafts are passed", () => {
    const html = adminHomeTemplate([]);

    expect(html).toContain("Draft posts");
    expect(html).toContain("No draft posts.");
    expect(html).not.toContain("/posts/draft-post");
  });
});
