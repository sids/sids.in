---
title: "Hello World"
slug: "hello-world"
date: "2024-12-29"
description: "My first blog post - getting started with a new blog"
tags: ["meta", "blogging"]
---

This is my first blog post. I built this blog using:

- **Cloudflare Workers** for hosting
- **TypeScript** for type safety
- **HTMX** for smooth page transitions
- **Tailwind CSS** for styling
- **Markdown** for content

The entire site is statically generated at build time, with markdown files bundled into the worker. This means fast response times and no database required.

## How it works

Markdown files live in the `content/` directory. A build script generates a manifest that imports all the content, which is then bundled by Wrangler into the worker.

At request time, the worker parses the markdown and renders HTML using templates. HTMX handles navigation with `hx-boost`, making the site feel like a single-page app.

## What's next

I plan to write about:

- Software engineering
- Web development
- Tools and productivity
- Random things I find interesting

Stay tuned!
