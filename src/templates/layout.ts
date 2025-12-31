import { escapeHtml } from "../markdown.ts";

const themeScript = `
(function() {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();
`;

const toggleScript = `
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateToggle();
}
function updateToggle() {
  const isDark = document.documentElement.classList.contains('dark');
  const toggle = document.getElementById('theme-switch');
  const icon = document.getElementById('theme-icon');
  const knob = document.getElementById('theme-knob');

  if (isDark) {
    toggle.classList.add('dark');
    icon.textContent = '☾';
    knob.style.transform = 'translateX(0)';
  } else {
    toggle.classList.remove('dark');
    icon.textContent = '☀';
    knob.style.transform = 'translateX(16px)';
  }
}
document.addEventListener('DOMContentLoaded', updateToggle);
`;

export function layout(content: string, title: string, description?: string, tag?: string): string {
  const tagFeedLink = tag
    ? `\n  <link rel="alternate" type="application/rss+xml" title="Posts tagged ${escapeHtml(tag)}" href="/tags/${tag}/feed.xml">`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | Siddhartha Reddy</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
  <link rel="icon" type="image/png" href="/images/s.png">
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="alternate" type="application/rss+xml" title="Sid's Blog" href="/posts/feed.xml">${tagFeedLink}
  <script>${themeScript}</script>
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script src="https://unpkg.com/htmx-ext-head-support@2.0.2/head-support.js"></script>
</head>
<body hx-ext="head-support" hx-boost="true" hx-target="#content" hx-swap="innerHTML" class="min-h-screen">
  <header class="border-b border-border">
    <nav class="content-width py-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <a href="/" class="group inline-flex flex-col">
        <span class="font-mono text-sm tracking-widest uppercase text-primary group-hover:text-accent transition-colors flex items-center gap-2">
          <img src="/images/s.png" alt="" class="w-5 h-5 rounded">
          <span class="group-hover:hidden">Sid</span>
          <span class="hidden group-hover:inline">Siddhartha Reddy Kottakapu</span>
        </span>
        <div class="h-0.5 w-full bg-accent mt-2" style="background-color: var(--accent)"></div>
      </a>
      <div class="flex items-center gap-2 font-mono text-sm md:flex-col md:items-end md:gap-1">
        <a href="/about" class="nav-link">About</a>
        <span class="text-secondary md:hidden">·</span>
        <a href="/posts" class="nav-link">Posts</a>
        <span class="text-secondary md:hidden">·</span>
        <a href="/archive" class="nav-link">Archive</a>
      </div>
    </nav>
  </header>
  <main id="content" class="content-width py-12">
    ${content}
  </main>
  <footer class="border-t border-border mt-24">
    <div class="content-width py-8 flex flex-col items-center gap-4 md:flex-row md:justify-between">
      <div class="flex items-center gap-4 md:order-2">
        <a href="/posts/feed.xml" hx-boost="false" class="font-mono text-xs text-secondary hover:text-accent transition-colors" aria-label="RSS Feed">RSS</a>
        <button onclick="toggleTheme()" class="theme-switch" id="theme-switch" aria-label="Toggle theme">
          <span class="theme-switch-icon" id="theme-icon">☀</span>
          <span class="theme-switch-knob" id="theme-knob"></span>
        </button>
      </div>
      <span class="font-mono text-xs text-secondary tracking-wide md:order-1">
        &copy; 2024&ndash;${new Date().getFullYear()} Siddhartha Reddy Kothakapu. All Rights Reserved.
      </span>
    </div>
  </footer>
  <script>${toggleScript}</script>
</body>
</html>`;
}

export function partial(content: string, title: string): string {
  return `<title>${escapeHtml(title)} | Siddhartha Reddy</title>
${content}`;
}
