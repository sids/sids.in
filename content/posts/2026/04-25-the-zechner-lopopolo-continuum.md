---
title: "The Zechner-Lopopolo Continuum"
slug: "the-zechner-lopopolo-continuum"
date: "2026-04-25"
description: ""
tags: ["agentic-engineering", "programming"]
link: "https://sub.thursdai.news/p/the-lopopolo-zechner-spectrum"
draft: false
---

Alex Volkov:

![The Zechner-Lopopolo Continuum](/images/zechner-lopopolo-continuum.png)

This is a recap of the AI Engineer Europe conference that took place in London a couple of weeks ago. But the more interesting thing is the debate that the title and above image points to.

[Mario Zechner](https://www.youtube.com/watch?v=RjfbvDXpFls) (creator of the Pi coding agent, my preferred coding agent) talked about
* why & how he built Pi (this summarises why I'm in love with Pi)
* the complexities brought about on OSS by people wielding agents and how he is tackling these with innovative solutions like OSS Vacations/Weekends
* (**critically**) advocating for reading critical code thoroughly and generally slowing down to ensure we don't drown in AI slop code

[Ryan Lopopolo](https://www.youtube.com/watch?v=am_oeAoUhew) (from OpenAI) talked about some vague things like code being a liability and how he is a "token billionaire"; and how he has mandated his team to not look at the code. Maybe he talked about more things, I just couldn't sit through the entire talk.

If it's not obvious, I'm firmly at the *Z*echner end of the continuum.

Maybe this will change in a couple of years or even in just a few months, but in April 2026, anyone who is too far out on the *L*opopolo end is taking on a lot of technical debt that they may not really be able to pay off.

And no: no amount of tests or specs is going to prevent that technical debt from building up, because the debt is not about correctness. The things that lead to this debt from agents are the same things that lead to debt buildup from humans: poor design choices, code duplication, needlessly defensive code, and many other such sins that agents can add at a pace hitherto unimaginable for humans.

The only way to prevent or tame this is for humans to read the code. Or break the problem down into small enough chunks so that agents actually follow the "don't duplicate code" and other testaments from our `AGENTS.md`s. Or in the words "human in the loop."

"But that will slow us down," I can hear some people say. Yes, slow the fuck down[^1].

[^1]: We'll still be way faster than we were a year ago, so don't despair.
