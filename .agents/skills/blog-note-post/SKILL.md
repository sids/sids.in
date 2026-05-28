---
name: blog-note-post
description: Create note posts for Sid's blog (sids.in). Use when Sid asks to draft, post, or publish a short original note that is not primarily an external link post.
---

# Blog Note Post

Create draft note posts from the repo root.

## Format

File location: `content/posts/YYYY/MM-DD-slug.md`

Frontmatter:
```yaml
---
title: "Post Title"
slug: "post-slug"
date: "YYYY-MM-DDTHH:mm:ss+05:30"
description: ""
tags: ["tag1", "tag2"]
draft: true
---
```

- Notes are posts outside `content/posts/articles/` without a `link` field.
- Use `draft: true` unless Sid explicitly asks for immediate publication.
- Use the current IST timestamp unless Sid specifies another date.
- Keep `description` empty unless Sid provides one or asks for a card summary.
- Pick 1-3 tags from existing content; create a new tag only if nothing fits.

Discover tags at runtime:
```bash
rg -No 'tags: \[.*?\]' content/posts/ --multiline | rg -o '"[^"]+"' | tr -d '"' | sort -u
```

## Workflow

1. Preserve Sid's wording. Do not rewrite the note body unless he asks.
2. Give brief editorial feedback before drafting if there are obvious typos, repetition, or unclear phrasing.
3. Write a draft markdown file under the current year directory.
4. Run `bun run build:manifest` or `bun run build` if the manifest/sitemap needs to be updated in the working tree.
5. Share the file path and concise draft summary for review.
6. Commit and push only after Sid approves.

## Rules

- Do not add a `link` field for note posts.
- Do not put notes in `content/posts/articles/`.
- If Sid wants a long-form article, use `content/posts/articles/` and treat it as an `article` post instead of a note.
- Do not publish by flipping `draft` to `false` unless Sid explicitly asks; Sid often publishes drafts from the admin UI.
