# Mission: Learn Effect by evolving sids.in

## Why
Use this production TypeScript codebase as a practical lab for learning Effect. Migrate it in small, reversible slices so each concept solves a real problem without destabilizing the blog.

## Success looks like
- Read an `Effect<Success, Error, Requirements>` type and explain all three channels.
- Migrate asynchronous leaf modules while preserving their public behavior and tests.
- Model expected failures and dependencies explicitly, then compose and test them.
- Judge where Effect improves the code and where ordinary TypeScript is enough.

## Constraints
- Learn by doing, one tightly scoped concept and migration slice at a time.
- Keep the Cloudflare Worker deployable and existing behavior covered by tests.
- Use the stable Effect 3 line while Effect 4 remains beta.

## Out of scope
- A wholesale rewrite.
- Adopting advanced Effect APIs before a concrete repository problem needs them.
- Migrating pure rendering helpers merely to increase Effect usage.
