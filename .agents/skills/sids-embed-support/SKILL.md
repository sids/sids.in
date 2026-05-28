---
name: sids-embed-support
description: Add, fix, or verify embedded external media on Sid's blog, including X/Twitter, YouTube, link preview embeds, CSP updates, tests, deploy monitoring, and live browser checks.
---

# Sids Embed Support

Use this when changing how posts render embedded external media.

## Relevant Files

- `src/templates/tweet-embed.ts`
- `src/templates/youtube-embed.ts`
- `src/templates/link-embed.ts`
- `src/templates/post.ts`
- `src/templates/partials/post-card.ts`
- `src/lib/security-headers.ts`
- Tests next to the affected templates and routes

## Rules

- For X/Twitter embeds, use the canonical `https://twitter.com/<user>/status/<id>` URL in embed markup. `x.com` URLs can fail to hydrate and leave only fallback content.
- Keep fallback links readable and safe when third-party scripts fail.
- Update CSP in `src/lib/security-headers.ts` whenever a new third-party script, frame, image, or connect target is required.
- Preserve local permalinks for feed identity; external URLs should be related/source links rather than replacing the local post URL.
- Only add a special embed to a post when Sid asks for that embed or the existing content already uses the supported embed syntax.

## Verification

1. Add or update focused tests for the parser/template/CSP behavior.
2. Run `bun test` and `bun run typecheck` when code changes are involved.
3. For Twitter/X embed behavior, do not stop at local tests. Commit and push after approval, monitor the Cloudflare deploy check, then verify the live page renders an actual embed iframe rather than only fallback text.
