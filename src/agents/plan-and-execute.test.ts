import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryStore } from "../store/memory-store.ts";
import { FakeChatModel, toolCall } from "./fake-model.helper.ts";
import { createPlanAndExecuteStrategy } from "./plan-and-execute.ts";
import { StrategyError } from "./strategy.errors.ts";
import { RunResult } from "./strategy.schema.ts";

const json = (value: unknown) => JSON.stringify(value);
const plan = (n: number) => json({ steps: Array.from({ length: n }, (_, i) => `step ${i + 1}`) });
const replan = (remaining: number, done = false, answer?: string) =>
  json({ done, remaining: Array.from({ length: remaining }, (_, i) => `next ${i + 1}`), rationale: "reviewed", answer });

const run = (model: FakeChatModel, maxIterations?: number) =>
  createPlanAndExecuteStrategy({ model, store: new MemoryStore() }).run("what is firing?", { maxIterations });

const stepResults = (trace: RunResult["trace"]) =>
  trace.filter((e) => e.type === "thought" && e.text.startsWith("Step result:"));

describe("plan-and-execute strategy", () => {
  it("plans, executes with tools, replans and answers; counts all calls", async () => {
    const model = new FakeChatModel([
      plan(2),
      toolCall("list_alerts", { status: "firing" }),
      "Found 3 firing alerts.",
      replan(1),
      "Nothing else needed.",
      replan(0, true, "3 alerts are firing."),
    ]);
    const result = RunResult.parse(await run(model));
    const types = result.trace.map((e) => e.type);
    assert.equal(types[0], "plan");
    for (const type of ["action", "observation", "critique", "answer"] as const) assert.ok(types.includes(type), type);
    assert.equal(types.at(-1), "answer");
    assert.equal(result.answer, "3 alerts are firing.");
    assert.equal(result.metrics.llmCalls, 6);
  });

  it("truncates a plan longer than 8 steps and records it", async () => {
    const model = new FakeChatModel([plan(12), "ok", replan(0, true, "done")]);
    const result = await run(model);
    const first = result.trace[0];
    assert.ok(first?.type === "plan" && first.steps.length === 8);
    assert.ok(result.trace.some((e) => e.type === "critique" && /truncated/i.test(e.text)));
  });

  it("never executes more than 8 steps", async () => {
    const script = [plan(10), ...Array.from({ length: 8 }, () => ["ok", replan(5)]).flat()];
    const result = await run(new FakeChatModel(script), 20);
    assert.equal(stepResults(result.trace).length, 8);
    assert.ok(result.trace.some((e) => e.type === "critique" && /8 steps/.test(e.text)));
    assert.equal(result.trace.at(-1)?.type, "answer");
  });

  it("respects maxIterations as a total executor budget", async () => {
    const script = [plan(5), ...Array.from({ length: 5 }, () => ["ok", replan(4)]).flat()];
    const result = await run(new FakeChatModel(script), 3);
    assert.equal(stepResults(result.trace).length, 3);
    assert.ok(result.trace.some((e) => e.type === "critique" && /iteration limit/i.test(e.text)));
    assert.match(result.answer, /partial/i);
    assert.equal(result.metrics.llmCalls, 1 + 3 * 2);
  });

  it("ends when the replanner leaves nothing, using the last step result", async () => {
    const result = await run(new FakeChatModel([plan(1), "Only step done.", replan(0)]));
    assert.match(result.answer, /Only step done/);
    assert.equal(result.trace.at(-1)?.type, "answer");
  });

  it("rejects an invalid plan with the partial metrics attached", async () => {
    const model = new FakeChatModel([json({ steps: [] })]);
    await assert.rejects(run(model), (error: unknown) => {
      assert.ok(error instanceof StrategyError);
      assert.equal(error.partial.metrics.llmCalls, 1);
      return true;
    });
  });
});
