---
title: "Codex CLI vs Claude Code on Autonomy"
slug: "codex-cli-vs-claude-code-autonomy"
date: "2026-02-18"
description: ""
tags: ["ai", "agentic-engineering"]
link: "http://blog.nilenso.com/blog/2026/02/12/codex-cli-vs-claude-code-on-autonomy/"
draft: false
---

nilenso:

> I spent some time studying the system prompts of coding agent harnesses like [Codex CLI](https://github.com/openai/codex/blob/main/codex-rs/core/gpt_5_2_prompt.md) and [Claude Code](https://github.com/asgeirtj/system_prompts_leaks/blob/main/Anthropic/claude-code-2025-11-1.md). These prompts reveal the priorities, values, and scars of their products. They're only a few pages each and worth reading in full, especially if you use them every day. This approach to understanding such products is more grounded than the vibe-based takes you often see in feeds.

> While there are many similarities and differences between them, one of the most commonly perceived differences between Claude Code and Codex CLI is autonomy, and in this post I'll share what I observed. We tend to perceive autonomous behaviour as long-running, independent, or requiring less supervision and guidance. Reading the system prompts, it becomes apparent that the products make very different, and very intentional choices.

Very interesting comparison. But I don't believe the difference in the behaviour is primarily, or even likely, driven by the system prompts. The difference is far more ingrained, most likely RL'd during post-training.

Why do I say this? I've been using both the models in [Pi coding agent](https://pi.dev/) with its [default system prompt](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/#toc_11)[^1], which is both really small and the same for all models. And even in Pi, this difference in behaviour comes across clearly.[^2]

[^1]: Pi allows us to replace the entire system prompt by placing a markdown file at `~/.pi/agent/SYSTEM.md`
[^2]: I feel that the models both behave better in Pi than in their respective canonical harnesses; but this is a very subjective opinion.
