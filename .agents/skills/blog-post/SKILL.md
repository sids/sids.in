---
name: blog-post
description: Use when Sid shares a URL or asks to draft, post, or publish content on sids.in. Creates link posts, notes, and articles while preserving Sid's wording.
---

# Blog Post

Create and publish posts to sids.in from the repository root.

## Choose the Post Type

- **Link post:** An external URL is central to the post. Store it outside `content/posts/articles/` and include a `link` field.
- **Note:** Short original writing that is not primarily about an external link. Store it outside `content/posts/articles/` and omit `link`.
- **Article:** Long-form original writing. Store it under `content/posts/articles/` and omit `link`.

If Sid shares a URL by itself or with brief context and does not specify another task, treat it as a link-post request.

## Common Format

File location for link posts and notes: `content/posts/YYYY/MM-DD-slug.md`

Article filenames follow the existing convention under `content/posts/articles/`.

```yaml
---
title: "Post Title"
slug: "post-slug"
date: "YYYY-MM-DDTHH:mm:ss+05:30"
description: ""
tags: ["tag1", "tag2"]
# link: "https://external-url.com/article" # link posts only
draft: true
---
```

- Use a concise title; for link posts it need not match the external article's title.
- Use a kebab-case slug.
- Get the current time when creating the draft and use an ISO timestamp with the IST offset (`+05:30`). Date-only values are accepted, but timestamps are preferred.
- Keep `description` empty for link posts and notes unless Sid supplies one or requests a card summary.
- Use `draft: true` unless Sid explicitly requests immediate publication.
- Use 1–3 existing tags. Create a tag only when none fit.

### Discover Tags at Runtime

Run before every post; never rely on a hardcoded tag list:

```bash
rg -No 'tags: \[.*?\]' content/posts/ --multiline | rg -o '"[^"]+"' | tr -d '"' | sort -u
```

## Link Posts

### Body Structure

1. Attribution: `Author Name:` or `[Author Name](url):`
2. Requested or supplied passages as Markdown blockquotes
3. Sid's commentary, exactly as approved

```markdown
Simon Willison:

> Quoted passage from the article.

Sid's commentary.
```

### Link-Post Rules

- Fetch the article to understand its context and identify the author.
- If Sid identifies passages by their opening words, quote the complete matching paragraphs.
- Treat text Sid presents as a quotation as quoted material and format it with `>`.
- **Never invent, draft, or silently rewrite Sid's commentary.** If he has not provided commentary, ask for it. Suggest edits separately and use only the version he approves.
- Separate multiple blockquotes with blank lines.
- Add `link` frontmatter containing the external URL.
- Only add an X/Twitter embed when Sid explicitly requests one. For embeds, use `https://twitter.com/<user>/status/<id>` in the embed blockquote; `x.com` URLs can remain stuck on the fallback link.
- After changing embed behavior, commit and push the code, invoke the `cloudflare-deployment-monitor` skill, and verify that the live page renders an iframe rather than only a fallback link.

## Notes and Articles

- Preserve Sid's wording. Do not rewrite the body unless he asks.
- Do not add a `link` field.
- Store notes outside `content/posts/articles/`.
- Store long-form articles under `content/posts/articles/`.

## Editorial Feedback

Before writing the draft, give brief, conversational feedback on Sid's prose. Flag only material issues:

- Obvious grammar or spelling problems
- Missing words or unclear sentences
- Awkward phrasing
- Nearby repetition
- Clichés that could be sharper

Do not nitpick minor punctuation or style, rewrite Sid's voice, or over-suggest. If the prose is clean, say so. Wait for Sid to accept an edit or request preservation before writing the file. If Sid says "just post it," proceed without blocking on feedback.

## Workflow

1. Determine whether the request is a link post, note, or article.
2. For a link post, fetch the source and collect the author and requested quotations.
3. Give light editorial feedback and obtain Sid's wording decision.
4. Discover existing tags and get the current IST timestamp.
5. Write the post with `draft: true` in the correct location.
6. Run `pnpm run build:manifest` or `pnpm run build` when the manifest or sitemap needs regeneration in the working tree.
7. Share the path and a concise summary, then **attach the Markdown file for review**. Do this after every creation or edit, not only the first draft.
8. Wait for approval. **Always confirm before committing.** Never auto-publish.
9. On approval, keep `draft: true`, stage only the intended files, commit with `Add <type> post: <slug>`, and push.
10. After the push, invoke `.agents/skills/cloudflare-deployment-monitor/SKILL.md` to monitor and verify the commit-specific Cloudflare build and deployment.
11. After successful deployment, share `https://sids.in/posts/<slug>`. Sid publishes drafts through the website admin UI, which stamps the publication time.

## Verification Checklist

- [ ] Correct post type, directory, and presence or absence of `link`
- [ ] Current IST timestamp and 1–3 runtime-discovered tags
- [ ] Sid's wording preserved exactly as approved
- [ ] Requested quotations copied completely and formatted as blockquotes
- [ ] `draft: true`
- [ ] Markdown file attached after creation or edit
- [ ] No commit before Sid's approval
- [ ] Deployment monitored and preview URL shared after push
