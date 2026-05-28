---
name: sids-static-game
description: Add or modify standalone static games on sids.in. Use when working on HTML/CSS/JS games under public/games, game index updates, or browser verification of those games.
---

# Sids Static Game

Build games as standalone static pages under `public/games/`.

## Structure

- Put each game in `public/games/<game>.html`.
- Update `public/games/index.html` when adding, renaming, or removing games.
- Keep pages self-contained unless shared assets clearly reduce duplication.
- Static game routes are served through the Worker assets binding because `/games/` is listed in `STATIC_PATHS` in `src/index.ts`.

## Implementation Guidance

- Do not use the blog Tailwind pipeline for game pages unless the task explicitly asks for site integration.
- Use stable dimensions for the playfield and responsive constraints for mobile.
- Keep controls visible and tappable on phones.
- Prefer deterministic game state and simple collision/physics code that is easy to inspect.
- Avoid changing unrelated blog templates or global styles.

## Verification

1. Run `bun run build` if shared site assets or generated files changed.
2. Start the dev server with `bun run dev` when browser verification is needed.
3. Open `/games/` and the changed game page in the browser.
4. Verify the game renders, starts, responds to keyboard and pointer input, and remains usable on a mobile-sized viewport.
