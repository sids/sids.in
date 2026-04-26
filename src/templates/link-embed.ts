import { tweetEmbedMarkupFromLink } from "./tweet-embed.ts";
import { youtubeEmbedMarkupFromLink } from "./youtube-embed.ts";

export function linkEmbedMarkupFromLink(link?: string, title?: string): string {
  return tweetEmbedMarkupFromLink(link) || youtubeEmbedMarkupFromLink(link, title);
}
