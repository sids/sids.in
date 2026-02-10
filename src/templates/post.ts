import type { Post, PostMeta } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { formatPostDate } from "./format-date.ts";
import { asideIcon, externalLinkIcon, ccIcon, ccByIcon, ccSaIcon } from "./icons.ts";
import { postsListCompact } from "./partials/posts-list.ts";
import { tagFilter, type TagFilterType } from "./partials/tag-filter.ts";
import { recentPostsPartial, recentPostsSection } from "./partials/recent-posts-section.ts";

export function postTemplate(
  post: Post,
  recentPosts: PostMeta[],
  currentTagFilter: TagFilterType = "all",
  canPublishDraft = false
): string {
  // Title: links to external URL with icon if link exists, otherwise just plain text
  const titlePrefix = post.postType === "aside" ? asideIcon : "";
  const titleHtml = post.link
    ? `<a href="${escapeHtml(post.link)}" class="text-primary" target="_blank" rel="noopener noreferrer">
      <h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4 text-primary">${externalLinkIcon}${escapeHtml(post.title)}</h1>
    </a>`
    : `<h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4 text-primary">${titlePrefix}${escapeHtml(post.title)}</h1>`;

  const draftBanner = post.draft
    ? `<div id="draft-publish-banner" class="mb-6 flex items-center justify-between gap-3 rounded border border-border bg-secondary px-4 py-3 text-sm text-primary" role="status" aria-live="polite">
      <span id="draft-publish-message">Draft preview: this post is not published yet and is shared for review.</span>
      ${canPublishDraft
        ? `<div id="draft-publish-actions" class="shrink-0">
          <form id="draft-publish-form" method="POST" action="/admin/api/publish" hx-boost="false">
            <input type="hidden" name="slug" value="${escapeHtml(post.slug)}" />
            <button type="submit" class="rounded border border-border bg-primary px-2 py-1 font-mono text-xs text-primary no-underline hover:text-accent">Publish</button>
          </form>
        </div>
        <span id="draft-publish-spinner" class="hidden shrink-0 text-secondary" aria-hidden="true">
          <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"></path>
          </svg>
        </span>`
        : `<a href="/admin/login" class="shrink-0 rounded border border-border bg-primary px-2 py-1 font-mono text-xs text-primary no-underline hover:text-accent hover:no-underline">Log in</a>`}
    </div>`
    : "";

  const publishDraftScript = post.draft && canPublishDraft
    ? `<script>
      (() => {
        const form = document.getElementById("draft-publish-form");
        const banner = document.getElementById("draft-publish-banner");
        const messageEl = document.getElementById("draft-publish-message");
        const actionsEl = document.getElementById("draft-publish-actions");
        const spinnerEl = document.getElementById("draft-publish-spinner");

        if (!form || !banner || !messageEl || !actionsEl || !spinnerEl) {
          return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const slug = ${JSON.stringify(post.slug)};
        const pollIntervalMs = 5000;
        const pollTimeoutMs = 120000;
        let isPublishing = false;

        function setTone(tone) {
          banner.classList.remove("text-primary", "text-secondary", "text-accent");
          if (tone === "error") {
            banner.classList.add("text-accent");
            return;
          }

          if (tone === "info") {
            banner.classList.add("text-secondary");
            return;
          }

          banner.classList.add("text-primary");
        }

        function setMessage(message, tone) {
          messageEl.textContent = message;
          setTone(tone);
        }

        function setSpinnerVisible(visible) {
          spinnerEl.classList.toggle("hidden", !visible);
        }

        function setActionsVisible(visible) {
          actionsEl.classList.toggle("hidden", !visible);
        }

        function wait(ms) {
          return new Promise((resolve) => setTimeout(resolve, ms));
        }

        async function isDeploymentReady() {
          const statusUrl = `/posts/${encodeURIComponent(slug)}?publish-check=${Date.now()}`;
          const response = await fetch(statusUrl, {
            headers: {
              "HX-Request": "true",
            },
            cache: "no-store",
          });

          if (!response.ok) {
            return false;
          }

          const html = await response.text();
          const document = new DOMParser().parseFromString(html, "text/html");
          const article = document.querySelector("article[data-post-draft]");
          return article?.getAttribute("data-post-draft") === "false";
        }

        form.addEventListener("submit", async (event) => {
          event.preventDefault();

          if (isPublishing) {
            return;
          }

          isPublishing = true;
          setActionsVisible(false);
          setSpinnerVisible(true);
          setMessage("Publishing draft…", "info");
          if (submitButton) {
            submitButton.disabled = true;
          }

          try {
            const publishResponse = await fetch("/admin/api/publish", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ slug }),
            });

            const publishPayload = await publishResponse.json().catch(() => null);
            if (!publishResponse.ok || (publishPayload && publishPayload.error)) {
              const errorMessage = publishPayload && typeof publishPayload.error === "string"
                ? publishPayload.error
                : "Failed to publish draft.";
              throw new Error(errorMessage);
            }

            setMessage("Published to GitHub. Waiting for deployment…", "info");

            const startedAt = Date.now();
            while (Date.now() - startedAt < pollTimeoutMs) {
              await wait(pollIntervalMs);

              try {
                const deployed = await isDeploymentReady();
                if (deployed) {
                  setSpinnerVisible(false);
                  setMessage("Deployment complete. Reloading…", "success");
                  window.setTimeout(() => {
                    window.location.reload();
                  }, 600);
                  return;
                }
              } catch {
                // Keep polling; transient fetch errors should not stop the deployment check.
              }
            }

            setSpinnerVisible(false);
            setActionsVisible(true);
            if (submitButton) {
              submitButton.disabled = false;
            }
            setMessage(
              "Published to GitHub, but deployment did not finish within 2 minutes. Please refresh in a bit.",
              "error"
            );
          } catch (error) {
            setSpinnerVisible(false);
            setActionsVisible(true);
            if (submitButton) {
              submitButton.disabled = false;
            }

            const errorMessage = error instanceof Error ? error.message : "Failed to publish draft.";
            setMessage(errorMessage, "error");
          } finally {
            isPublishing = false;
          }
        });
      })();
    </script>`
    : "";

  const tagFilterMarkup = tagFilter(
    `/posts/${post.slug}`,
    post.tags,
    currentTagFilter
  );
  const emptyMessage = currentTagFilter === "all"
    ? "No recent posts yet."
    : `No recent posts tagged "${escapeHtml(currentTagFilter)}".`;
  const recentPostsSectionMarkup = recentPostsSection({
    filterMarkup: tagFilterMarkup,
    listMarkup: postsListCompact(recentPosts, "all", emptyMessage),
  });

  // Post footer with tags and license
  const tagsMarkup =
    post.tags.length > 0
      ? `<p class="text-secondary">Tagged as ${post.tags.map((tag) => `<a href="/tags/${tag}" class="tag-pill">${escapeHtml(tag)}</a>`).join(" ")}</p>`
      : "";

  const licenseMarkup = `<p class="text-secondary text-sm">
    This post is licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer license" class="align-middle"><span class="inline-flex items-center gap-1 align-middle">${ccIcon}${ccByIcon}${ccSaIcon}</span> CC BY-SA 4.0</a>
  </p>`;

  const endMark = `<div class="text-center text-secondary text-lg tracking-widest mt-12" aria-hidden="true">· · ·</div>`;

  return `<article data-post-draft="${post.draft ? "true" : "false"}">
  <header class="mb-12">
    ${draftBanner}
    <time class="date-mono block mb-3">${formatPostDate(post.date)}</time>
    ${titleHtml}
  </header>
  <div class="post-content">
    ${post.html}
  </div>
  <footer class="mt-12 flex flex-col gap-3">
    ${tagsMarkup}
    ${licenseMarkup}
    ${endMark}
  </footer>
</article>
${recentPostsSectionMarkup}
${publishDraftScript}`;
}

export function postRecentPostsPartial(
  recentPosts: PostMeta[],
  tags: string[],
  currentTagFilter: TagFilterType = "all",
  basePath: string
): string {
  const emptyMessage = currentTagFilter === "all"
    ? "No recent posts yet."
    : `No recent posts tagged "${escapeHtml(currentTagFilter)}".`;
  return recentPostsPartial(
    postsListCompact(recentPosts, "all", emptyMessage),
    tagFilter(basePath, tags, currentTagFilter, true)
  );
}
