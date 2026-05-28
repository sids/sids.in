---
name: blog-link-post
description: Publish link posts to Sid's blog (sids.in). Use when Sid shares a URL with commentary and wants it posted to his blog. Triggers on requests to blog/post/publish a link, or when Sid shares a link and says to post it.
---

# Blog Link Post

Publish link posts to sids.in from the repo root.

## Post Format

File location: `content/posts/YYYY/MM-DD-slug.md`

Frontmatter:
```yaml
---
title: "Post Title"
slug: "post-slug"
date: "YYYY-MM-DDTHH:mm:ss+05:30"
description: ""
tags: ["tag1", "tag2"]
link: "https://external-url.com/article"
draft: true
---
```

- `title`: A concise, descriptive title (not necessarily the article's original title — Sid may rephrase)
- `slug`: Kebab-case version of title
- `description`: Usually left empty for link posts
- `tags`: Pick from existing tags (see below). Use 1-3 tags. Create new ones only if nothing fits.
- `link`: The external URL being linked to
- `date`: Use ISO timestamp with IST timezone offset (`+05:30`), e.g. `2026-04-25T09:03:29+05:30`. Get the current time at draft creation. Date-only (`YYYY-MM-DD`) is also accepted but timestamps are preferred.
- `draft: true` unless Sid explicitly asks for immediate publication

### Existing Tags
**Always discover tags at runtime** — never hardcode a tag list. Run this before every post:
```bash
rg -No 'tags: \[.*?\]' content/posts/ --multiline | rg -o '"[^"]+"' | tr -d '"' | sort -u
```
Pick from the results. Use 1-3 tags. Create new ones only if nothing fits.

## Body Structure

1. **Attribution line**: `Author Name:` or `[Author Name](url):` — who wrote the linked piece
2. **Blockquotes**: Key passages from the article. If Sid includes quoted text in his message, format as markdown blockquotes (`> ...`)
3. **Commentary**: Sid's own thoughts/take on the piece. **Never draft commentary** — always use Sid's exact words. You may suggest edits to his commentary as a message, but never rewrite it in the file.

Example body:
```markdown
Simon Willison:

> Quoted passage from the article here.

Sid's commentary paragraph here.
```

Multiple blockquotes are fine — separate them with blank lines. Long quotes can use `>` on each line.

## Workflow

1. Sid shares a link + commentary (and possibly quoted text)
2. Fetch the linked article to understand context and get author name
3. **Give light editorial feedback** on Sid's commentary before drafting (see Editorial Feedback below)
4. Wait for Sid to acknowledge or adjust based on feedback
5. Assemble the post file with `draft: true`
6. Pick appropriate tags from the existing set
7. **Write the file to disk** at `content/posts/YYYY/MM-DD-slug.md` with `draft: true`
8. Share the file path and summarize the exact draft content so Sid can review it. Do this every time you create or edit the file, not just the first draft.
9. Wait for Sid's approval or edits
10. On approval: **keep `draft: true`** and commit and push from the repo root:
   ```bash
   git add .
   git commit -m "Add link post: <slug>"
   git push
   ```
11. **Monitor the deploy.** After pushing, get the commit SHA and poll the Cloudflare Workers build check run:
   ```bash
   COMMIT=$(git rev-parse HEAD)
   gh api repos/sids/sids.in/commits/$COMMIT/check-runs --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'
   ```
   Poll every ~15 seconds until `status` is `completed`. Then share the draft preview URL: `https://sids.in/posts/<slug>` — Sid will publish from the website himself (the admin UI has a publish endpoint that stamps the current date/time).

## Key Rules

- **Always confirm before committing.** Write as draft first, share as attachment. Never auto-publish.
- If Sid includes text that looks like a quote from the article, make it a blockquote.
- **Never draft or rewrite Sid's commentary.** Use his words exactly. Suggest edits separately as a message.
- Use the current IST timestamp (ISO format with `+05:30`) unless Sid specifies otherwise.
- The filename format is `MM-DD-slug.md` inside the year directory.
- **Only add X/Twitter embeds if Sid explicitly asks for an embed.** Default behavior for link posts is just the normal link + quoted text/commentary.
- **When adding X/Twitter embed support to the site, use the canonical embed URL form `https://twitter.com/<user>/status/<id>` inside the embed blockquote.** Using `x.com/.../status/...` can leave the page stuck on the fallback link instead of rendering the widget.
- **After changing embed behavior, don't stop at local code/tests.** Commit and push, monitor deploy to completion, and verify the live page in a browser to confirm it renders an actual embed iframe rather than just the fallback link.

## Editorial Feedback

Before creating the draft, give Sid light feedback on his commentary. Keep it brief and non-pedantic — a few bullet points, not an essay.

**Flag:**
- Obvious grammatical issues (typos, missing words, subject-verb agreement)
- Clichés or overused phrases that could be sharper
- Repetition (same word/idea appearing too close together)
- Unclear sentences that might confuse a reader
- Awkward phrasing that could flow better

**Don't:**
- Nitpick style preferences or minor comma placement
- Rewrite his voice — Sid's tone is his own
- Over-suggest — if the commentary is clean, just say so and move on
- Block on feedback — if Sid says "just post it", skip ahead

Keep it conversational: "Heads up — X reads a bit awkward, maybe Y?" not "I recommend restructuring the third clause for improved readability."
