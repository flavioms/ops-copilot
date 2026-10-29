import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LlmCallCounter } from "./llm-call-counter.ts";

describe("LlmCallCounter", () => {
  it("counts every chat model start", () => {
    const counter = new LlmCallCounter();
    counter.handleChatModelStart();
    counter.handleChatModelStart();
    assert.equal(counter.count, 2);
  });

  it("can be reset", () => {
    const counter = new LlmCallCounter();
    counter.handleChatModelStart();
    counter.reset();
    assert.equal(counter.count, 0);
  });
});
