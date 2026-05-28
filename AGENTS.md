## Project Overview

A personal blog (sids.in) built as a Cloudflare Worker. Markdown content is bundled at build time and served with HTMX for smooth page transitions. Uses Tailwind CSS for styling.

## Styling Conventions

**Color Classes:**
Use Tailwind utility classes for colors instead of inline styles:
- `.text-primary` - for primary text color (instead of `style="color: var(--text-primary)"`)
- `.text-secondary` - for secondary text color (instead of `style="color: var(--text-secondary)"`)
- `.text-accent` - for accent color
- `.bg-primary`, `.bg-secondary` - for background colors
- `.border-border` - for border colors

These classes are defined in `styles/input.css` and automatically adapt to light/dark themes.

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server (CSS watch + Wrangler dev)
bun run build        # Build CSS + generate manifest
bun run deploy       # Build and deploy to Cloudflare
bun run build:css    # Build Tailwind CSS only
bun run build:manifest  # Regenerate content manifest only
```

## Architecture

**Content Flow:**
1. Markdown files in `content/` are bundled at build time via Wrangler's `rules` config
2. `scripts/build-manifest.ts` generates `src/manifest.ts` with pre-processed metadata
3. Worker (`src/index.ts`) dispatches to route handlers for pages and admin tools
4. `scripts/build-manifest.ts` also generates `public/sitemap.xml` during builds

## Link Handling

**Local skill triggers:**
- If Sid shares a link by itself or with brief context and does not specify another task, use the local `blog-link-post` skill at `.agents/skills/blog-link-post/SKILL.md`.
- If Sid asks to draft, post, or publish an original note that is not primarily an external link, use `.agents/skills/blog-note-post/SKILL.md`.
- If Sid asks to add or modify a standalone game under `/games/`, use `.agents/skills/sids-static-game/SKILL.md`.
- If Sid asks to add, fix, or verify embedded external media, use `.agents/skills/sids-embed-support/SKILL.md`.

**Post types:**
- Posts under `content/posts/articles/` are treated as `postType: "article"`.
- Posts outside `content/posts/articles/` with a `link` frontmatter field are treated as `postType: "link"`.
- Posts outside `content/posts/articles/` without a `link` frontmatter field are treated as `postType: "note"`.
- In list views (`src/templates/partials/post-card.ts`), link titles point to the external URL and include the external-link icon, while the date and "Read Now →" link point to the local post page.
- Post filtering is supported via the `type=article`, `type=note`, and `type=link` query params on `/`, `/posts`, `/archive`, and tag pages.
- Legacy `type=essay` URLs are permanently redirected to `type=article`; legacy `type=aside` and `type=brief` URLs are permanently redirected to `type=note`.

**Internal vs. external links:**
- Default links inherit text color with underline styling from `styles/input.css`.
- Use `.link-accent` for emphasized internal navigation links (e.g., pagination, archive/home CTAs).

**Admin Section:**
- `/admin` contains protected tools for authoring content (link posts + notes).
- `src/routes/admin.ts` defines admin routes and API endpoints.
- Sign in with Apple OAuth is used for authentication, restricted to `ADMIN_EMAIL`.
- Session-based auth via signed cookies (no KV storage required).

**Static Games:**
- Standalone games live under `public/games/` and are served as static assets via `env.ASSETS`.
- Update `public/games/index.html` when adding or removing games.
- Keep game pages self-contained unless there is a clear reason to share assets.

**Key Files:**
- `src/index.ts` - Worker entry point and router (dispatches to routes)
- `src/manifest.ts` - Auto-generated content index (do not edit manually)
- `src/markdown.ts` - Frontmatter parsing using `front-matter` and `marked`
- `src/routes/` - Route handlers for pages and admin endpoints
- `src/templates/` - HTML templates (layout, page, post, archive, tags)

**Content Structure:**
- `content/pages/**/*.md` → Static pages (e.g., `home.md` → `/`, `about.md` → `/about`)
- `content/posts/**/*.md` → Blog posts (e.g., `my-post.md` → `/posts/my-post`); supports nested directories for organization

**HTMX Partial Rendering:**
The worker detects `HX-Request` header and returns partial HTML (content only) instead of full page. See `isPartialHtmxRequest` handling in `src/index.ts`.

**Typography:**
- `font-heading` uses the self-hosted Geist Pixel font and is reserved for `h1` headings.
- Use sans headings for `h2`/`h3` and compact UI headings unless the surrounding code already uses `font-heading`.

## Adding Content

1. Create markdown file in `content/pages/` or `content/posts/` with frontmatter
2. Run `bun run build` to regenerate manifest
3. Deploy with `bun run deploy`

Post frontmatter:
```yaml
---
title: "Post Title"
slug: "post-slug"
date: "2024-12-29"
description: "Brief description"
tags: ["tag1", "tag2"]
draft: false
---
```

## Constraints

- Tailwind v3 (v4 has Cloudflare compatibility issues)
- Static assets (including `robots.txt` and `sitemap.xml`) served via Workers Static Assets binding (`env.ASSETS`)
- CSS compiled to `public/css/styles.css` - don't edit directly
- Run Wrangler via `bunx wrangler` (see scripts in `package.json`)
