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
  it("marks compact post titles for font testing", () => {
    const html = postsListCompact([post]);

    expect(html).toContain('class="post-title-font text-lg text-primary"');
  });

  it("marks archive post titles for font testing", () => {
    const html = postsListArchive([post]);

    expect(html).toContain('class="post-title-font text-lg text-primary"');
  });
});
