import type { Page } from "../types.ts";

export function pageTemplate(page: Page): string {
  return `<article class="post-content">
  ${page.html}
</article>`;
}
