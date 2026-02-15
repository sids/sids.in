import type { Page } from "../types.ts";
import { newsletterEmbed } from "./partials/subscribe.ts";

export function pageTemplate(page: Page): string {
  return `<article class="post-content">
  ${page.html}
</article>
${newsletterEmbed()}`;
}
