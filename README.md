# sids.in

Personal blog built as a Cloudflare Worker. Markdown content lives under `content/`, is bundled at build time, and is rendered by Worker route handlers with HTMX-enhanced navigation.

## Project organization

```txt
content/
  pages/          Static pages such as home, about, and newsletter
  posts/          Blog posts, link posts, notes, drafts, and articles
public/           Static assets served by the Workers Static Assets binding
scripts/          Build and sync scripts
src/
  index.ts        Worker entrypoint and top-level request dispatch
  manifest.ts     Generated content manifest; do not edit manually
  markdown.ts     Frontmatter and Markdown rendering helpers
  routes/         Page and admin route handlers
  templates/      HTML templates and HTMX partials
  lib/            Shared helpers for auth, dates, tags, sessions, etc.
styles/           Tailwind input CSS; compiled CSS is written to public/css
```

Post types are inferred from location/frontmatter:

- `content/posts/articles/**` → article
- other posts with `link:` → link post
- other posts without `link:` → note

Draft posts use `draft: true` frontmatter and are included in internal indexes but skipped from public post lists.

## Common commands

```sh
bun install
bun run dev
bun run build
bun run deploy
```

Other useful commands:

```sh
bun run build:css       # Compile Tailwind CSS to public/css/styles.css
bun run build:manifest  # Regenerate src/manifest.ts and public/sitemap.xml
bun run typecheck
bun test
```

## Content and build flow

Markdown files are imported as text by Wrangler using the `rules` entry in `wrangler.jsonc`. The build step runs `scripts/build-manifest.ts`, which:

1. scans `content/pages/**/*.md` and `content/posts/**/*.md`
2. parses frontmatter with `front-matter`
3. normalizes post metadata, tags, dates, and links
4. generates `src/manifest.ts`
5. generates `public/sitemap.xml`

At runtime, the Worker imports the generated manifest and renders pages from `src/routes/pages.ts` and templates under `src/templates/`.

## HTMX navigation

The layout loads HTMX and enables boosted navigation on the page body:

```html
<body hx-boost="true" hx-target="#content" hx-swap="innerHTML">
```

Normal browser requests receive a full HTML document from `layout(...)`. HTMX requests include `HX-Request: true`; `src/index.ts` detects these and returns only the content partial so page transitions replace `#content` without a full reload.

History restore requests are treated specially: if `HX-History-Restore-Request: true` is present, the Worker returns full HTML so HTMX can rebuild browser history state correctly.

## Runtime and deployment architecture

The site runs as a Cloudflare Worker configured in `wrangler.jsonc`:

- `src/index.ts` is the Worker entrypoint.
- Static files in `public/` are served through the `ASSETS` binding.
- Markdown files are bundled as text modules at build time.
- `/css/`, `/fonts/`, `/games/`, `/images/`, `/js/`, `/robots.txt`, and `/sitemap.xml` are routed to static assets before dynamic routing.
- Versioned CSS/images and immutable fonts/JS get long-lived cache headers.
- Dynamic routes are dispatched to admin routes first, then public page routes.
- Responses pass through shared security headers.

Deployment is:

```sh
bun run deploy
```

which runs the build and then `bunx wrangler deploy`.

## Admin and authoring

The `/admin` section contains protected tools for authoring link posts and notes. Authentication uses Sign in with Apple, restricted by `ADMIN_EMAIL`, with signed-cookie sessions and no KV dependency.

Standalone games live under `public/games/` and are served as static assets. Update `public/games/index.html` when adding or removing games.

## Bear post sync

Posts in `content/posts/**/*.md` can be synced two-way with Bear using `bearcli`.

Run a safe preview first:

```sh
bun run sync:bear:dry-run
```

Apply the sync:

```sh
bun run sync:bear
```

The sync script:

- matches local posts to Bear notes using `.bear-posts-sync.json`
- creates missing Bear notes from local posts
- creates local Markdown files from new Bear notes tagged under `#sids.in`
- updates the side that changed when only one side changed
- reports and skips conflicts when both sides changed
- archives Bear notes when their local post was deleted
- keeps Bear tags in sync from frontmatter tags as nested tags under `#sids.in`

Managed Bear tags:

- `#sids.in`
- `#sids.in/<tag>` for each YAML frontmatter tag
- `#sids.in/~draft` for draft posts
- `#sids.in/~article` for article posts and for routing new Bear-created notes to `content/posts/articles/`

New Bear-created notes should contain normal post frontmatter. Path routing is:

- `#sids.in/~article` → `content/posts/articles/YYYY-MM-slug.md`
- otherwise → `content/posts/YYYY/MM-DD-slug.md`

Bear inserts tag lines into note content. The sync script treats managed `#sids.in...` tag lines as Bear metadata: it ignores them for change detection and strips them before writing Bear content back to local Markdown.

For readability in Bear, synced Bear notes also get a Markdown title copied from frontmatter immediately after the YAML block:

```md
---
title: "Post Title"
...
---

# Post Title
```

That Bear-only heading is ignored for change detection and stripped before writing content back to `content/posts`. If the Bear heading and frontmatter title differ, the frontmatter title wins the next time the note is synced from files to Bear.
