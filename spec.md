# Markdown Blog on Cloudflare Workers

## Overview

A personal blog powered by markdown files, hosted on Cloudflare Workers, using TypeScript, HTMX (for page transitions), and Tailwind CSS (compiled at build time).

## Design

### Aesthetic

Swiss/Minimal design with distinctive but professional feel.

### Typography

- **Display/Headings**: JetBrains Mono (monospace)
- **Body**: IBM Plex Sans
- **Date format**: `YYYY.MON.DD` in monospace (e.g. `2026.APR.25`)

### Color Scheme

CSS variables for theming, with dark mode support.

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | #FAFAFA | #171717 |
| Secondary BG | #F0F0F0 | #242424 |
| Text | #1A1A1A | #FAFAFA |
| Secondary text | #666666 | #999999 |
| Accent | #cd5c2e | #cd5c2e |
| Accent hover | #b34d22 | #e07040 |
| Border | #E5E5E5 | #2A2A2A |

### Dark Mode

- System preference detection via `prefers-color-scheme`
- Manual override stored in `localStorage`
- Toggle switch in footer with sun/moon icons
- CSS class strategy (`html.dark`)

### Layout

**Header:**
- Site name "Sid" expands to "Siddhartha Reddy Kottakapu" on hover
- Orange accent underline that expands on hover
- Navigation: `About · Posts · Archive`

**Footer:**
- Copyright left, theme toggle right (desktop)
- Toggle above copyright, centered (mobile)
- Theme switch: dark background with sun icon (light mode), light background with moon icon (dark mode), orange gradient knob

### Responsive Breakpoints

- Mobile-first approach
- `md` (768px+): Desktop layout with side-by-side header/footer elements

## Project Structure

```
sids.in/
├── content/                  # All markdown content (separate from src)
│   ├── pages/                # Static pages (convention-based routing)
│   │   ├── home.md           # → /
│   │   └── about.md          # → /about
│   └── posts/                # Blog posts
│       ├── articles/          # Article posts
│       ├── 2025/              # Dated posts (notes + link logs)
│       └── *.md               # → /posts/{slug}
├── src/
│   ├── index.ts              # Worker entry point and router
│   ├── routes/               # Route handlers (pages, admin tools)
│   ├── lib/                  # Pagination + response helpers
│   ├── markdown.ts           # Markdown parsing with frontmatter
│   ├── manifest.ts           # Auto-generated content manifest
│   ├── rss.ts                # RSS feed generation
│   ├── types.ts              # TypeScript interfaces
│   └── templates/
│       ├── layout.ts         # Base HTML layout with HTMX
│       ├── home.ts           # Home page (home.md + recent posts)
│       ├── page.ts           # Generic page template
│       ├── post.ts           # Individual post template
│       ├── post-list.ts      # /posts - cards with descriptions or full content
│       ├── archive.ts        # /archive - tags + posts by year
│       ├── tag.ts            # /tags/{tag} - posts with tag
│       ├── pagination.ts     # Pagination component
│       ├── admin/            # Admin templates (dashboard, link log, note)
│       └── partials/
│           ├── post-card.ts  # Card with title, date, description/content
│           ├── post-filter.ts # Filter controls for post type
│           └── posts-list.ts # List renderers (cards, compact, archive)
├── public/                   # Static assets (served by Workers)
│   ├── css/styles.css        # Compiled Tailwind (generated)
│   ├── fonts/                # Self-hosted web fonts
│   ├── images/
│   ├── js/                   # Self-hosted browser scripts
│   ├── robots.txt
│   └── sitemap.xml
├── styles/
│   └── input.css             # Tailwind source
├── scripts/
│   └── build-manifest.ts     # Generates content manifest
├── wrangler.jsonc
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

## Content Types

### Pages (content/pages/*.md)

Convention-based routing: filename becomes URL path.

```yaml
---
title: "About Me"
description: "Learn more about me"
---
```

- `home.md` → `/`
- `about.md` → `/about`
- `contact.md` → `/contact`

### Posts (content/posts/*.md)

```yaml
---
title: "Post Title"
slug: "post-slug"
date: "2024-12-29T14:30:00Z"
description: "Brief description for cards and SEO"
tags: ["typescript", "cloudflare"]
draft: false
link: "https://example.com" # Optional; marks link posts
---
```

The `date` field accepts either `YYYY-MM-DD` or an ISO-style timestamp such as `YYYY-MM-DDTHH:mm:ssZ` / `YYYY-MM-DDTHH:mm:ss+05:30`. Date-only values are treated as midnight UTC for sorting and feed output; timestamps without an explicit timezone are also interpreted as UTC.

**Post types:**
- Posts under `content/posts/articles/` are treated as `article` entries.
- Posts outside `articles/` are treated as `link` when `link` is present; otherwise they are `note` posts.
- Link titles in list views point to the external URL (with icon), while the date and "Read Now →" link to the local post page.
- Draft posts (`draft: true`) are excluded from all public listings, tag indexes, feeds, and sitemap, but remain directly accessible at `/posts/{slug}` for private review via shared URLs.
- Draft post pages show a visible “draft preview” banner.

## URL Routes

| Route | Template | Description |
|-------|----------|-------------|
| `/` | home.ts | Home page (from home.md + recent posts) |
| `/{page}` | page.ts | Static pages (about, contact, etc.) |
| `/posts` | post-list.ts | Paginated cards with descriptions or full content |
| `/posts?page=2` | post-list.ts | Pagination via query param |
| `/posts/{slug}` | post.ts | Individual post |
| `/archive` | archive.ts | Tags + posts grouped by year |
| `/tags/{tag}` | tag.ts | Paginated posts with tag |
| `/posts/feed` | templates/feed.ts | Feed landing page for all posts (links to Atom/RSS) |
| `/tags/{tag}/feed` | templates/feed.ts | Feed landing page for a tag (links to Atom/RSS + global feed page) |
| `/posts/feed.xml` | rss.ts | RSS feed for all posts |
| `/posts/feed.atom` | atom.ts | Atom feed for all posts |
| `/tags/{tag}/feed.xml` | rss.ts | RSS feed for tag |
| `/tags/{tag}/feed.atom` | atom.ts | Atom feed for tag |
| `/admin` | routes/admin.ts | Admin dashboard (password-protected) |
| `/admin/link-log` | routes/admin.ts | Authenticated link log submission form |
| `/admin/note` | routes/admin.ts | Authenticated note submission form |
| `/admin/api/link-log` | routes/admin.ts | Authenticated API endpoint that creates link log posts in GitHub |
| `/admin/api/link-log/metadata` | routes/admin.ts | Authenticated metadata fetch for auto-titling |
| `/admin/api/note` | routes/admin.ts | Authenticated API endpoint that creates note posts in GitHub |
| `/admin/api/publish` | routes/admin.ts | Authenticated API endpoint that publishes draft posts and stamps the current date/time |
| `/robots.txt` | - | Robots file (static asset) |
| `/sitemap.xml` | - | Sitemap generated at build time |
| `/css/*`, `/fonts/*`, `/images/*`, `/js/*` | - | Static assets |

## Pagination

- Default: 10 posts per page
- Query param: `?page=N`
- Shows: prev/next links, page numbers
- Applied to: `/posts`, `/tags/{tag}`

## Post Filtering

- Filter query param: `?type=article`, `?type=note`, or `?type=link`
- Legacy `?type=essay` URLs are permanently redirected to `?type=article`; `?type=aside` and `?type=brief` URLs are permanently redirected to `?type=note` for backwards compatibility
- Available on `/`, `/posts`, `/archive`, and `/tags/{tag}` via the filter UI
- HTMX updates swap `#posts-list` and update the filter nav out-of-band

## Syndication Feeds

- RSS 2.0 format with `content:encoded` for full HTML
- RSS `<pubDate>` / `<lastBuildDate>` and Atom `<published>` / `<updated>` use the full post timestamp when present
- Link posts keep local permalinks in RSS `<item><link>` / `<guid>` for stable item identity; external URLs are included in the item content and Atom `rel="related"` links
- Atom feeds are available alongside RSS and include `rel="alternate"` and `rel="related"` links for link posts
- Feed discovery via `<link rel="alternate">` in HTML head
- `/posts/feed` and `/tags/{tag}/feed` are human-readable feed pages that link to Atom and RSS variants
- Footer links point to `/posts/feed`; tag pages point to `/tags/{tag}/feed`
- Direct Atom/RSS links use `hx-boost="false"` to bypass HTMX

## Key Dependencies

- `marked` - Markdown to HTML (zero deps, works in Workers)
- `front-matter` - YAML frontmatter parsing
- `@cloudflare/workers-types` - TypeScript types
- `wrangler` - Cloudflare CLI
- `tailwindcss` + `@tailwindcss/typography` - Styling
- `concurrently` - Run dev scripts in parallel

## HTMX Integration

- `hx-boost="true"` on body for automatic link enhancement
- `hx-target="#content"` to swap only main content area
- `head-support` extension for title updates
- Worker detects `HX-Request` header → returns partial content (title + main only)
- CSS transitions for smooth page swaps

## Build Pipeline

```bash
bun run dev      # Start dev server with CSS watch
bun run build    # Build CSS + generate manifest
bun run deploy   # Build and deploy to Cloudflare
```

## Manifest Structure (auto-generated)

`src/manifest.ts` is generated by `scripts/build-manifest.ts` at build time:

```typescript
export const pages: Record<string, { title: string; description: string; content: string }>;
export const posts: PostMeta[];              // sorted by date/timestamp desc
export const postContent: Record<string, string>;  // slug → markdown
export const tagIndex: Record<string, string[]>;   // tag → slugs
export const allTags: { tag: string; count: number }[];  // sorted by count
export const contentVersion: string | null; // git short SHA if available
```

## Technical Notes

- Markdown files bundled at build time via Wrangler's `rules: [{ type: "Text", globs: ["**/*.md"] }]`
- Content lives in `content/` (outside `src/`) for clean separation
- Excerpt: first ~150 chars of rendered content (stripped of HTML); currently unused in templates
- Static assets served via Workers Static Assets binding
- Versioned CSS/image URLs, fonts, and self-hosted JavaScript assets are served with long-lived immutable cache headers
- `scripts/build-manifest.ts` writes `public/sitemap.xml` during build
- Tailwind v3 (v4 has Cloudflare compatibility issues)
- HTMX is self-hosted from `public/js/`
- CSS variables defined in `:root` and `:root.dark` for theming
- Dark mode uses class strategy with JavaScript for localStorage persistence
- Typography-aware content width: `min(70ch, 100% - 3rem)`
- Fonts are self-hosted Overpass and Overpass Mono web fonts
- Admin authoring (link log + note) is protected with Sign in with Apple OAuth and uses GitHub's Contents API to create and publish markdown files.
- Admin HTML pages and draft post previews use `Cache-Control: private, no-store` and omit ETags.
- Admin-created posts and draft publishes write `date` with the current ISO timestamp.
- Admin secrets are stored as Cloudflare Worker environment variables:
  - `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `SESSION_SECRET`, `ADMIN_EMAIL`
  - `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, optional `GITHUB_BRANCH`

## Adding Content

1. **New post**: Create `content/posts/my-post.md` with frontmatter
2. **New page**: Create `content/pages/about.md` → accessible at `/about`
3. Run `bun run build` to regenerate manifest
4. Deploy with `bun run deploy`
