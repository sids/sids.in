import { escapeHtml } from "../markdown.ts";

export function layout(content: string, title: string, description?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
  <link rel="stylesheet" href="/css/styles.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script src="https://unpkg.com/htmx-ext-head-support@2.0.2/head-support.js"></script>
</head>
<body hx-ext="head-support" hx-boost="true" hx-target="#content" hx-swap="innerHTML" class="min-h-screen bg-white text-slate-900">
  <header class="border-b border-slate-200">
    <nav class="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
      <a href="/" class="text-xl font-semibold hover:text-slate-600">Sid</a>
      <div class="flex gap-6 text-sm">
        <a href="/posts" class="hover:text-slate-600">Posts</a>
        <a href="/archive" class="hover:text-slate-600">Archive</a>
        <a href="/tags" class="hover:text-slate-600">Tags</a>
      </div>
    </nav>
  </header>
  <main id="content" class="max-w-3xl mx-auto px-4 py-8">
    ${content}
  </main>
  <footer class="border-t border-slate-200 mt-16">
    <div class="max-w-3xl mx-auto px-4 py-6 text-sm text-slate-500 text-center">
      &copy; 2024-${new Date().getFullYear()} Siddhartha Reddy Kothakapu. All Rights Reserved.
    </div>
  </footer>
</body>
</html>`;
}

export function partial(content: string, title: string): string {
  return `<title>${escapeHtml(title)}</title>
${content}`;
}
