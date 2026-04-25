---
title: "Coding Models Are Doing Too Much"
slug: "coding-models-are-doing-too-much"
date: "2026-04-25"
description: ""
tags: ["agentic-engineering", "programming"]
link: "https://nrehiew.github.io/blog/minimal_editing/"
draft: false
---

nrehiew:

> If you have used any of these tools in the past year, you have probably experienced something like this: you ask the model to fix a simple bug (perhaps a single off-by-one error, or maybe a wrong operator). The model fixes the bug but half the function has been rewritten. An extra helper function has appeared. A perfectly reasonable variable name has been renamed. New input validation has been added. And the diff is enormous.
>
> I refer to this as the Over-Editing problem where models have the tendency to rewrite code that didn't need rewriting.

Yes! A thousand times, yes.

GPT models are especially prone to this overediting problem. A part of this comes from writing code that is way too defensive[^1], but it's not just that — they are really eager to "fix" your code even when there is really no need for that.

Thankfully, GPT models are also very good at following instructions. So I have had instructions to circumvent this problem in my global AGENTS.md for a while and it helps quite a bit.

This is what the linked post also found: the over-editing reduces across models when they are prompted for it.

This is a good post. It's not an opinion piece, but takes a scientific approach by setting up experiments and providing evidence in the form of results.

[^1]: I've seen a couple comments saying that GPT-5.5 has gotten better in this regard and doesn't write such defensive code anymore. I'm yet to ascertain this.
