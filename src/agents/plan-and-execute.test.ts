import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryStore } from "../store/memory-store.ts";
import { FakeChatModel, toolCall } from "./fake-model.helper.ts";
import { createPlanAndExecuteStrategy } from "./plan-and-execute.ts";
import { StrategyError } from "./strategy.errors.ts";
import { RunResult } from "./strategy.schema.ts";

const json = (value: unknown) => JSON.stringify(value);
const plan = (n: number) => json({ steps: Array.from({ length: n }, (_, i) => `step ${i + 1}`) });
const proceed = () => json({ action: "continue", rationale: "on track" });
const adjust = (steps: string[]) => json({ action: "adjust", steps, rationale: "plan changed" });
const finish = (answer?: string) => json({ action: "finish", rationale: "objective met", answer });
const sent = (model: FakeChatModel) => model.received.map((m) => m.map((x) => String(x.content)).join("\n")).join("\n=====\n");

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
      proceed(),
      "Nothing else needed.",
      finish("3 alerts are firing."),
    ]);
    const result = RunResult.parse(await run(model));
    const types = result.trace.map((e) => e.type);
    assert.equal(types[0], "plan");
    for (const type of ["action", "observation", "critique", "answer"] as const) assert.ok(types.includes(type), type);
    assert.equal(types.at(-1), "answer");
    assert.equal(result.answer, "3 alerts are firing.");
    assert.equal(result.metrics.llmCalls, 6);
  });

  it("continue keeps the remaining plan untouched", async () => {
    const model = new FakeChatModel([plan(2), "one", proceed(), "two", finish("end")]);
    await run(model);
    assert.match(sent(model), /Current step: step 2/);
  });

  it("adjust replaces the remaining steps and records the new plan", async () => {
    const model = new FakeChatModel([plan(3), "one", adjust(["new A", "new B"]), "two", finish("end")]);
    const result = await run(model);
    assert.match(sent(model), /Current step: new A/);
    assert.doesNotMatch(sent(model), /Current step: step 2/);
    assert.ok(result.trace.some((e) => e.type === "plan" && e.steps.join() === "new A,new B"));
  });

  it("adjust without steps behaves like continue", async () => {
    const model = new FakeChatModel([plan(2), "one", json({ action: "adjust", rationale: "hmm" }), "two", finish("end")]);
    await run(model);
    assert.match(sent(model), /Current step: step 2/);
  });

  it("finish ends the run even if steps remain, using the replanner answer", async () => {
    const result = await run(new FakeChatModel([plan(3), "one", finish("early answer")]));
    assert.equal(result.answer, "early answer");
    assert.equal(result.trace.filter((e) => e.type === "thought" && e.text.startsWith("Step result:")).length, 1);
  });

  it("truncates a plan longer than 8 steps and records it", async () => {
    const model = new FakeChatModel([plan(12), "ok", finish("done")]);
    const result = await run(model);
    const first = result.trace[0];
    assert.ok(first?.type === "plan" && first.steps.length === 8);
    assert.ok(result.trace.some((e) => e.type === "critique" && /truncated/i.test(e.text)));
  });

  it("caps adjusted plans so the total never exceeds 8 steps", async () => {
    const big = Array.from({ length: 10 }, (_, i) => `n${i + 1}`);
    const model = new FakeChatModel([plan(2), "one", proceed(), "two", adjust(big), ...Array(10).fill(["ok", proceed()]).flat()]);
    const result = await run(model, 20);
    const adjusted = result.trace.filter((e) => e.type === "plan").at(-1);
    assert.ok(adjusted?.type === "plan" && adjusted.steps.length === 6);
    assert.equal(stepResults(result.trace).length, 8);
    assert.ok(result.trace.some((e) => e.type === "critique" && /truncated from 10 to 6/.test(e.text)));
  });

  it("never executes more than 8 steps", async () => {
    const script = [plan(10), ...Array.from({ length: 8 }, () => ["ok", proceed()]).flat()];
    const result = await run(new FakeChatModel(script), 20);
    assert.equal(stepResults(result.trace).length, 8);
    assert.ok(result.trace.some((e) => e.type === "critique" && /8 steps/.test(e.text)));
    assert.equal(result.trace.at(-1)?.type, "answer");
  });

  it("respects maxIterations as a total executor budget", async () => {
    const script = [plan(5), ...Array.from({ length: 5 }, () => ["ok", proceed()]).flat()];
    const result = await run(new FakeChatModel(script), 3);
    assert.equal(stepResults(result.trace).length, 3);
    assert.ok(result.trace.some((e) => e.type === "critique" && /iteration limit/i.test(e.text)));
    assert.match(result.answer, /partial/i);
    assert.equal(result.metrics.llmCalls, 1 + 3 * 2);
  });

  it("ends when nothing remains after the last step, using that step's result", async () => {
    const result = await run(new FakeChatModel([plan(1), "Only step done.", proceed()]));
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
