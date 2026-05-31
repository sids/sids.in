import { describe, expect, it } from "bun:test";
import type { PostMeta } from "../../types.ts";
import { postsListArchive, postsListCompact } from "./posts-list.ts";

const post: PostMeta = {
  title: "A Title Worth Testing",
  slug: "a-title-worth-testing",
  date: "2026-05-31",
  description: "",
  tags: [],
  postType: "article",
  draft: false,
};

describe("post list title typography", () => {
  it("aligns compact list dates with post titles", () => {
    const html = postsListCompact([post]);

    expect(html).toContain('class="flex items-baseline gap-6 py-2 group"');
    expect(html).toContain('class="post-title-font text-lg leading-tight text-primary"');
  });

  it("aligns archive list dates with post titles", () => {
    const html = postsListArchive([post]);

    expect(html).toContain('class="flex items-baseline gap-6 py-2 group"');
    expect(html).toContain('class="post-title-font text-lg leading-tight text-primary"');
  });
});
