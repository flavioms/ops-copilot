import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryStore } from "../store/memory-store.ts";
import { FakeChatModel, toolCall } from "./fake-model.helper.ts";
import { createReactStrategy } from "./react.ts";
import { RunResult } from "./strategy.schema.ts";

const run = (model: FakeChatModel, maxIterations?: number) =>
  createReactStrategy({ model, store: new MemoryStore() }).run("what is firing?", { maxIterations });

describe("react strategy", () => {
  it("answers using a tool and reports trace and metrics", async () => {
    const model = new FakeChatModel([toolCall("list_alerts", { status: "firing" }), "3 alerts are firing"]);
    const result = RunResult.parse(await run(model));
    assert.deepEqual(result.trace.map((e) => e.type), ["action", "observation", "answer"]);
    assert.equal(result.answer, "3 alerts are firing");
    assert.equal(result.metrics.llmCalls, 2);
    assert.ok(result.metrics.latencyMs >= 0);
  });

  it("answers without tools", async () => {
    const result = await run(new FakeChatModel(["Nothing to look up."]));
    assert.deepEqual(result.trace, [{ type: "answer", text: "Nothing to look up." }]);
    assert.equal(result.metrics.llmCalls, 1);
  });

  it("stops at the iteration limit with a partial answer", async () => {
    const model = new FakeChatModel([toolCall("list_alerts", { status: "firing" })], { repeatLast: true });
    const result = await run(model, 2);
    assert.ok(result.metrics.llmCalls <= 2, `llmCalls=${result.metrics.llmCalls}`);
    assert.ok(result.trace.some((e) => e.type === "critique" && /limit/i.test(e.text)));
    assert.equal(result.trace.at(-1)?.type, "answer");
    assert.match(result.answer, /partial/i);
  });

  it("surfaces invalid tool arguments as an observation and recovers", async () => {
    const model = new FakeChatModel([toolCall("list_alerts", { status: "bogus" }), "Could not list alerts."]);
    const result = await run(model);
    const observation = result.trace.find((e) => e.type === "observation");
    assert.ok(observation && /status|invalid|error/i.test(observation.content));
    assert.equal(result.answer, "Could not list alerts.");
  });

  it("keeps the partial trace when the model fails", async () => {
    const model = new FakeChatModel([toolCall("list_alerts", { status: "firing" })]);
    await assert.rejects(run(model), (error: Error & { partial?: { trace: unknown[] } }) => {
      assert.match(error.message, /scripted replies/);
      assert.ok((error.partial?.trace.length ?? 0) >= 2);
      return true;
    });
  });

});
