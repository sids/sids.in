---
title: "Multi-Agents: What's Actually Working"
slug: "multi-agents-whats-actually-working"
date: "2026-04-25T06:22:11+05:30"
description: ""
tags: ["agentic-engineering", "programming"]
link: "https://x.com/walden_yan/status/2047054401341370639"
draft: false
---

I've largely sat out the hype around multi-agent orchestration or agent swarms because it felt too gimmicky. Heck, I've only recently started using subagents in a limited way (mostly explicitly invoked when I feel like something is parallelizable).

This blog post is not trying to hype these up. It is a measured take on how Cognition has been able to use some limited forms of this in production for Devin (background/cloud agent) and what they had to do to make it work well.

Walden Yan (Cognition):

> **1) The Code-Review-Loop that's so stupid it shouldn't work**
>
> You would think that making a model review its own code would not result in any useful findings. But even on PRs written by Devin, Devin Review catches an average of 2 bugs per PR, of which roughly 58% are severe (logic errors, missing edge cases, security vulnerabilities). Often the system will loop through multiple code-review cycles, finding new bugs each time (which isn't always great since it can take a while). Today, we make Devin and Devin Review natively iterate against one another, so that most bugs are already resolved by the time a human opens the PR.

This is effectively my (manual) workflow in almost every coding agent I have used for several months now. Of course, Cognition has automated this as a workflow, which makes sense in a background agent like Devin.

I wouldn't want to automate it in my manual workflow though, as I tend to not accept all the review comments from the review agent. Hence why I don't use extensions such as [pi-review-loop](https://github.com/nicobailon/pi-review-loop) which exist to do just that.

---

> **2) Large, expensive models are back - introducing "Smart Friend"**
>
> The actual architecture we used to achieve this was by offering the smarter/expansive model as a "smart friend" tool that the primary/smaller model could make a call out to. Basically, let the primary/smaller model decide when a situation was tricky enough to be worth consulting the smarter/expensive model.

This is basically akin to Amp Code's /oracle[^1] but invoked automatically (by exposing it as a tool). Seems obviously beneficial if the primary model is not smart enough to tackle the problem at hand.

---

> What about unstructured swarms? We think the unstructured-swarm approach, arbitrary networks of agents negotiating with each other, is mostly a distraction. The practical shape is map-reduce-and-manage: a manager splits work, children execute, the manager synthesizes and reports back. Making this type of system feel as coherent as a single agent working on a single task is at the center of some of our upcoming work in 2026.

---

> There's a shared through-line with all of these experiments: multi-agent systems work best today when writes stay single-threaded and the additional agents contribute intelligence rather than actions. A clean-context reviewer catches bugs the coder can't see. A frontier-level smart friend catches subtleties a weaker primary misses. A manager coordinates scope across child agents without fragmenting decisions.
>
> The open problems are all communication problems. How does a weaker model learn when to escalate? How does a child agent surface a discovery that should change its siblings' work? How do you transfer context between agents without drowning the receiver? You can get decently far with prompting, but we also expect the next generation of models, including the ones we train ourselves, to start closing these gaps.

[^1]: Peter Steinberger has an [/oracle](https://github.com/steipete/oracle) prompt template to use in any agent for consulting GPT Pro models for such situations.
