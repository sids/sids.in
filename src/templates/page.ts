import type { Page } from "../types.ts";
import { newsletterEmbed } from "./partials/subscribe.ts";

export function pageTemplate(page: Page): string {
  const newsletter = page.slug === "newsletter" ? "" : newsletterEmbed();
  return `<article class="post-content">
  ${page.html}
</article>
${newsletter}`;
}
