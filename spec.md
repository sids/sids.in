# Markdown Blog on Cloudflare Workers

## Overview

A personal blog powered by markdown files, hosted on Cloudflare Workers, using TypeScript, HTMX (for page transitions), and Tailwind CSS (compiled at build time).

## Design

### Aesthetic

Swiss/Minimal design with distinctive but professional feel.

### Typography

- **Display/Headings**: JetBrains Mono (monospace)
- **Body**: IBM Plex Sans
- **Date format**: `YYYY.MM.DD` in monospace

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
│       └── *.md              # → /posts/{slug}
├── src/
│   ├── index.ts              # Worker entry point and router
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
│       └── partials/
│           ├── post-card.ts  # Card with title, date, description/content
│           ├── post-filter.ts # Filter controls for post type
│           └── posts-list.ts # List renderers (cards, compact, archive)
├── public/                   # Static assets (served by Workers)
│   ├── css/styles.css        # Compiled Tailwind (generated)
│   └── images/
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
date: "2024-12-29"
description: "Brief description for cards and SEO"
tags: ["typescript", "cloudflare"]
draft: false
link: "https://example.com" # Optional; marks link-log posts
---
```

**Post types:**
- Posts with `link` are treated as `link-log` entries; otherwise they are `essay` posts.
- Link-log titles in list views point to the external URL (with icon), while the date and "Read Now →" link to the local post page.

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
| `/posts/feed.xml` | rss.ts | RSS feed for all posts |
| `/tags/{tag}/feed.xml` | rss.ts | RSS feed for tag |
| `/link-log` | link-log.ts | Authenticated link log submission form |
| `/api/link-log` | index.ts | Authenticated API endpoint that creates link log posts in GitHub |
| `/api/link-log/metadata` | index.ts | Authenticated metadata fetch for auto-titling |
| `/css/*`, `/images/*` | - | Static assets |

## Pagination

- Default: 10 posts per page
- Query param: `?page=N`
- Shows: prev/next links, page numbers
- Applied to: `/posts`, `/tags/{tag}`

## Post Filtering

- Filter query param: `?type=essay` or `?type=link-log`
- Available on `/`, `/posts`, `/archive`, and `/tags/{tag}` via the filter UI
- HTMX updates swap `#posts-list` and update the filter nav out-of-band

## RSS Feeds

- RSS 2.0 format with `content:encoded` for full HTML
- Feed discovery via `<link rel="alternate">` in HTML head
- Footer link to main feed; tag pages link to tag-specific feed
- Feed links use `hx-boost="false"` to bypass HTMX

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
export const posts: PostMeta[];              // sorted by date desc
export const postContent: Record<string, string>;  // slug → markdown
export const tagIndex: Record<string, string[]>;   // tag → slugs
export const allTags: { tag: string; count: number }[];  // sorted by count
```

## Technical Notes

- Markdown files bundled at build time via Wrangler's `rules: [{ type: "Text", globs: ["**/*.md"] }]`
- Content lives in `content/` (outside `src/`) for clean separation
- Excerpt: first ~150 chars of rendered content (stripped of HTML); currently unused in templates
- Static assets served via Workers Static Assets binding
- Tailwind v3 (v4 has Cloudflare compatibility issues)
- HTMX loaded from CDN (unpkg)
- CSS variables defined in `:root` and `:root.dark` for theming
- Dark mode uses class strategy with JavaScript for localStorage persistence
- Typography-aware content width: `min(70ch, 100% - 3rem)`
- Google Fonts: IBM Plex Sans and JetBrains Mono loaded via CSS import
- Link log submission is protected with HTTP Basic Auth and uses GitHub's Contents API to create new markdown files.
- Link log secrets are stored as Cloudflare Worker environment variables:
  - `BASIC_AUTH_PASSWORD` (required) + optional `BASIC_AUTH_USER`
  - `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, optional `GITHUB_BRANCH`

## Adding Content

1. **New post**: Create `content/posts/my-post.md` with frontmatter
2. **New page**: Create `content/pages/about.md` → accessible at `/about`
3. Run `bun run build` to regenerate manifest
4. Deploy with `bun run deploy`
