import { escapeHtml } from "../markdown.ts";

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function validVideoId(videoId: string | null | undefined): string | undefined {
  if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
    return undefined;
  }

  return videoId;
}

function videoIdFromYouTubeUrl(url: URL): string | undefined {
  const hostname = url.hostname.toLowerCase();

  if (hostname === "youtu.be" || hostname === "www.youtu.be") {
    return validVideoId(url.pathname.split("/").filter(Boolean)[0]);
  }

  if (
    hostname !== "youtube.com" &&
    hostname !== "www.youtube.com" &&
    hostname !== "m.youtube.com" &&
    hostname !== "youtube-nocookie.com" &&
    hostname !== "www.youtube-nocookie.com"
  ) {
    return undefined;
  }

  if (url.pathname === "/watch") {
    return validVideoId(url.searchParams.get("v"));
  }

  const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
  return validVideoId(match?.[1]);
}

function secondsFromTimestamp(timestamp: string): number | undefined {
  const value = timestamp.trim().toLowerCase();
  const secondsOnlyMatch = value.match(/^(\d+)s?$/);
  if (secondsOnlyMatch?.[1]) {
    return Number(secondsOnlyMatch[1]);
  }

  const durationMatch = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!durationMatch || !durationMatch.slice(1).some(Boolean)) {
    return undefined;
  }

  const hours = Number(durationMatch[1] ?? "0");
  const minutes = Number(durationMatch[2] ?? "0");
  const seconds = Number(durationMatch[3] ?? "0");
  return hours * 3600 + minutes * 60 + seconds;
}

function startSecondsFromYouTubeUrl(url: URL): number | undefined {
  const timestamp = url.searchParams.get("start") ?? url.searchParams.get("t");
  if (!timestamp) {
    return undefined;
  }

  const seconds = secondsFromTimestamp(timestamp);
  if (!seconds || !Number.isSafeInteger(seconds)) {
    return undefined;
  }

  return seconds;
}

export function youtubeEmbedMarkupFromLink(link?: string, title = "YouTube video"): string {
  if (!link) {
    return "";
  }

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return "";
  }

  const videoId = videoIdFromYouTubeUrl(url);
  if (!videoId) {
    return "";
  }

  const startSeconds = startSecondsFromYouTubeUrl(url);
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}${startSeconds ? `?start=${startSeconds}` : ""}`;
  const iframeTitle = `${title} - YouTube video`;

  return `<div class="youtube-embed my-8 not-prose">
    <iframe
      class="aspect-video w-full rounded-lg border border-border bg-secondary"
      src="${escapeHtml(embedUrl)}"
      title="${escapeHtml(iframeTitle)}"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen
    ></iframe>
  </div>`;
}
