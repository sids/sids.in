import { tweetEmbedMarkupFromLink } from "./tweet-embed.ts";
import { youtubeEmbedMarkupFromLink } from "./youtube-embed.ts";

export function linkEmbedMarkupFromLink(link?: string | null, title?: string): string {
  return tweetEmbedMarkupFromLink(link ?? undefined) || youtubeEmbedMarkupFromLink(link ?? undefined, title);
}
