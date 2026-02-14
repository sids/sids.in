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

**Post types:**
- Posts under `content/posts/essays/` are treated as `postType: "essay"`.
- Use the `link` frontmatter field to mark a post as a `postType: "link-log"` entry.
- Other posts default to `postType: "aside"`.
- In list views (`src/templates/partials/post-card.ts`), link-log titles point to the external URL and include the external-link icon, while the date and "Read Now →" link point to the local post page.
- Post filtering is supported via the `type=essay`, `type=aside`, and `type=link` query params on `/`, `/posts`, `/archive`, and tag pages.
- Legacy `type=brief` URLs are permanently redirected to `type=aside` for backwards compatibility.

**Internal vs. external links:**
- Default links inherit text color with underline styling from `styles/input.css`.
- Use `.link-accent` for emphasized internal navigation links (e.g., pagination, archive/home CTAs).

**Admin Section:**
- `/admin` contains protected tools for authoring content (link log + asides).
- `src/routes/admin.ts` defines admin routes and API endpoints.
- Sign in with Apple OAuth is used for authentication, restricted to `ADMIN_EMAIL`.
- Session-based auth via signed cookies (no KV storage required).

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

## Documentation

Keep `spec.md` updated whenever making architectural or fundamental changes, or when implementation diverges from what's documented there.
