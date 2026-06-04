---
title: "Your memory system does not need to decide what the agent sees. The agent does."
slug: "your-memory-system-does-not-need-to-decide-what-the-agent-sees"
date: "2026-06-04T09:59:55.678Z"
description: ""
tags: ["ai", "agentic-engineering"]
link: "https://x.com/s_batman/status/2061878438697263219"
draft: false
---

Steven (Batman) Batchelor-Manning:

> I've been down the rabbit hole on how memory reaches the model for a while now. The assumption I kept running into, before this research, was that the hard part of agent memory was retrieval quality. Get the right chunks, the thinking goes, and the rest is plumbing.
>
> That assumption is half right. Retrieval quality matters. But the mechanism that delivers those chunks to the model matters more, and the field has quietly reversed its position on it without most people noticing. The mature systems have all converged on the same shape: the agent is given memory tools, and the agent decides when and how to use them. The middleware is no longer a predictor of what the agent needs. It's a service the agent calls.

The first part of this post is about how the world has moved from RAG to tools for giving relevant context to the agent. While this has been described in reference to memory systems, it's more broadly applicable.

> Of the 19 systems I went through, the mature ones have all converged on this shape. Supermemory, Graymatter, OpenContext, Tolaria, second-brain, MemoryOS, GitNexus, mem9 all expose memory as a tool surface rather than as automatic injection. The systems that do something closer to injection are the ones the field treats as the prior state of the art, not the current one.

The second part compares and contrasts several memory systems. I hadn't heard of most of these, and having these listed at one place is itself valuable. The choices made by the different systems are also quite fascinating.

*Footnote: The post feels like it was written (or heavily edited) by AI. It's valuable nevertheless.*
