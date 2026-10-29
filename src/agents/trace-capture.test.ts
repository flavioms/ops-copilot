import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { lastText, messagesToTrace } from "./trace-capture.ts";

const messages = [
  new HumanMessage("what is firing?"),
  new AIMessage({
    content: "Let me check",
    tool_calls: [{ name: "list_alerts", args: { status: "firing" }, id: "c1", type: "tool_call" }],
  }),
  new ToolMessage({ content: "[3 alerts]", tool_call_id: "c1", name: "list_alerts" }),
  new AIMessage("3 alerts are firing"),
];

describe("messagesToTrace", () => {
  it("maps messages to typed events and ends with the answer", () => {
    assert.deepEqual(messagesToTrace(messages), [
      { type: "thought", text: "Let me check" },
      { type: "action", tool: "list_alerts", args: { status: "firing" } },
      { type: "observation", tool: "list_alerts", content: "[3 alerts]" },
      { type: "answer", text: "3 alerts are firing" },
    ]);
  });

  it("skips empty thoughts and resolves the tool name from the call id", () => {
    const trace = messagesToTrace([
      new AIMessage({ content: "", tool_calls: [{ name: "x", args: {}, id: "c9", type: "tool_call" }] }),
      new ToolMessage({ content: "ok", tool_call_id: "c9" }),
    ]);
    assert.deepEqual(trace, [
      { type: "action", tool: "x", args: {} },
      { type: "observation", tool: "x", content: "ok" },
    ]);
  });

  it("omits the answer when the run ended on a tool call", () => {
    const trace = messagesToTrace(messages.slice(0, 3));
    assert.equal(trace.at(-1)?.type, "observation");
  });
});

describe("lastText", () => {
  it("returns the last assistant text", () => {
    assert.equal(lastText(messages), "3 alerts are firing");
  });

  it("returns an empty string when there is none", () => {
    assert.equal(lastText([new HumanMessage("hi")]), "");
  });
});
