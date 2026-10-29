import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTrace } from "./trace-format.ts";
import type { TraceEvent } from "./strategy.schema.ts";

const trace: TraceEvent[] = [
  { type: "plan", steps: ["list alerts", "open incident"] },
  { type: "thought", text: "I need the firing alerts" },
  { type: "action", tool: "list_alerts", args: { status: "firing" } },
  { type: "observation", tool: "list_alerts", content: "[3 alerts]" },
  { type: "critique", text: "Enough information" },
  { type: "answer", text: "3 alerts are firing" },
];

describe("formatTrace", () => {
  it("renders every event kind on a labelled line", () => {
    assert.equal(
      formatTrace(trace),
      [
        "[plan]        1. list alerts",
        "              2. open incident",
        "[thought]     I need the firing alerts",
        '[action]      list_alerts({"status":"firing"})',
        "[observation] list_alerts -> [3 alerts]",
        "[critique]    Enough information",
        "[answer]      3 alerts are firing",
      ].join("\n"),
    );
  });

  it("is deterministic", () => {
    assert.equal(formatTrace(trace), formatTrace(trace));
  });

  it("indents multi-line text under the label", () => {
    assert.equal(
      formatTrace([{ type: "answer", text: "line one\nline two" }]),
      "[answer]      line one\n              line two",
    );
  });

  it("returns an empty string for an empty trace", () => {
    assert.equal(formatTrace([]), "");
  });
});
