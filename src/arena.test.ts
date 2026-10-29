import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArenaArgs, runArena } from "./arena.ts";
import { StrategyError } from "./agents/strategy.errors.ts";
import type { ReasoningStrategy } from "./agents/strategy.types.ts";

const fake = (name: ReasoningStrategy["name"], answer: string): ReasoningStrategy => ({
  name,
  async run(_input, options) {
    return {
      answer: `${answer}${options?.maxIterations ?? ""}`,
      trace: [{ type: "answer", text: answer }],
      metrics: { llmCalls: 2, latencyMs: 7 },
    };
  },
});

const failing: ReasoningStrategy = {
  name: "plan-and-execute",
  async run() {
    throw new StrategyError("model unreachable", { trace: [{ type: "thought", text: "hmm" }], metrics: { llmCalls: 1, latencyMs: 3 } });
  },
};

const capture = () => {
  const lines: string[] = [];
  return { lines, write: (text: string) => void lines.push(text) };
};

describe("parseArenaArgs", () => {
  it("applies defaults", () => {
    assert.deepEqual(parseArenaArgs(["list alerts"]), {
      strategies: ["react", "plan-and-execute"],
      maxIterations: 10,
      request: "list alerts",
    });
  });

  it("reads flags", () => {
    const args = parseArenaArgs(["--strategies", "react", "--max-iterations", "4", "hello"]);
    assert.deepEqual(args, { strategies: ["react"], maxIterations: 4, request: "hello" });
  });

  it("rejects an unknown strategy naming the valid ones", () => {
    assert.throws(() => parseArenaArgs(["--strategies", "foo", "x"]), /react.*plan-and-execute/s);
  });

  it("rejects an invalid iteration limit and a missing request", () => {
    assert.throws(() => parseArenaArgs(["--max-iterations", "0", "x"]), /max-iterations/);
    assert.throws(() => parseArenaArgs([]), /request/);
  });
});

describe("runArena", () => {
  const strategies = { react: fake("react", "R"), "plan-and-execute": fake("plan-and-execute", "P") };

  it("prints header, trace, answer and metrics per selected strategy", async () => {
    const out = capture();
    const code = await runArena(["--max-iterations", "3", "q"], { strategies, write: out.write });
    const text = out.lines.join("\n");
    assert.equal(code, 0);
    assert.match(text, /=== react ===/);
    assert.match(text, /=== plan-and-execute ===/);
    assert.match(text, /\[answer\]\s+R/);
    assert.match(text, /Answer: R3/);
    assert.match(text, /llmCalls=2 latencyMs=7/);
  });

  it("runs only the selected strategy", async () => {
    const out = capture();
    await runArena(["--strategies", "react", "q"], { strategies, write: out.write });
    assert.doesNotMatch(out.lines.join("\n"), /plan-and-execute/);
  });

  it("keeps going when one strategy fails and exits 1", async () => {
    const out = capture();
    const code = await runArena(["q"], { strategies: { ...strategies, "plan-and-execute": failing }, write: out.write });
    const text = out.lines.join("\n");
    assert.equal(code, 1);
    assert.match(text, /=== react ===[\s\S]*Answer: R10/);
    assert.match(text, /FAILED: model unreachable/);
    assert.match(text, /llmCalls=1 latencyMs=3/);
  });

  it("exits 1 with a message on invalid arguments", async () => {
    const out = capture();
    assert.equal(await runArena(["--strategies", "foo", "q"], { strategies, write: out.write }), 1);
    assert.match(out.lines.join("\n"), /react, plan-and-execute/);
  });
});
