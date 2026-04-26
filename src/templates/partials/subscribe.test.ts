import { describe, expect, it } from "bun:test";
import { newsletterSection, postSubscribePrompt } from "./subscribe.ts";

describe("newsletter subscribe forms", () => {
  it("renders a Substack subscribe link instead of the Substack iframe", () => {
    const html = newsletterSection();

    expect(html).toContain('href="https://siddhartha.substack.com/subscribe?utm_source=sids.in"');
    expect(html).toContain('hx-boost="false"');
    expect(html).toContain("self-start");
    expect(html).toContain("Subscribe on Substack");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("siddhartha.substack.com/embed");
  });

  it("uses the Substack subscribe link in post prompts", () => {
    const html = postSubscribePrompt();

    expect(html).toContain("Subscribe on Substack");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<iframe");
  });
});
