# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal blog (sids.in) built as a Cloudflare Worker. Markdown content is bundled at build time and served with HTMX for smooth page transitions. Uses Tailwind CSS for styling.

## Commands

```bash
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
3. Worker (`src/index.ts`) serves content by parsing markdown on request

**Key Files:**
- `src/index.ts` - Worker entry point and router
- `src/manifest.ts` - Auto-generated content index (do not edit manually)
- `src/markdown.ts` - Frontmatter parsing using `front-matter` and `marked`
- `src/templates/` - HTML templates (layout, page, post, archive, tags)

**Content Structure:**
- `content/pages/*.md` → Static pages (e.g., `home.md` → `/`, `about.md` → `/about`)
- `content/posts/*.md` → Blog posts (e.g., `my-post.md` → `/posts/my-post`)

**HTMX Partial Rendering:**
The worker detects `HX-Request` header and returns partial HTML (content only) instead of full page. See `isHtmx` handling in `src/index.ts`.

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
- Static assets served via Workers Static Assets binding (`env.ASSETS`)
- CSS compiled to `public/css/styles.css` - don't edit directly

## Documentation

Keep `spec.md` updated whenever making architectural or fundamental changes, or when implementation diverges from what's documented there.
