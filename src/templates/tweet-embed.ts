import { escapeHtml } from "../markdown.ts";

export function tweetEmbedMarkupFromLink(link?: string): string {
  if (!link) {
    return "";
  }

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return "";
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname !== "x.com" && hostname !== "www.x.com" && hostname !== "twitter.com" && hostname !== "www.twitter.com") {
    return "";
  }

  const match = url.pathname.match(/^\/(?:#!\/)?([^/]+)\/status\/(\d+)/);
  if (!match) {
    return "";
  }

  const [, username, statusId] = match;
  const canonicalUrl = `https://twitter.com/${username}/status/${statusId}`;

  return `<div class="tweet-embed my-8 not-prose">
    <blockquote class="twitter-tweet" data-dnt="true" data-theme="light">
      <a href="${escapeHtml(canonicalUrl)}"></a>
    </blockquote>
    <script>
      (() => {
        const root = document.currentScript?.closest(".tweet-embed") || document;
        const loaderSelector = 'script[data-tweet-embed-loader="true"]';

        function renderTweet() {
          if (window.twttr?.widgets?.load) {
            window.twttr.widgets.load(root);
          }
        }

        renderTweet();
        if (window.twttr?.widgets?.load) {
          return;
        }

        const existingLoader = document.querySelector(loaderSelector);
        if (existingLoader) {
          existingLoader.addEventListener("load", renderTweet, { once: true });
          return;
        }

        const loader = document.createElement("script");
        loader.src = "https://platform.twitter.com/widgets.js";
        loader.async = true;
        loader.charset = "utf-8";
        loader.dataset.tweetEmbedLoader = "true";
        loader.addEventListener("load", renderTweet, { once: true });
        document.head.appendChild(loader);
      })();
    </script>
  </div>`;
}
