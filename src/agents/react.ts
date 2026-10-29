import type { BaseMessage } from "@langchain/core/messages";
import { GraphRecursionError } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { recursionLimitFor } from "./iteration-limit.ts";
import { LlmCallCounter } from "./llm-call-counter.ts";
import { OPS_SYSTEM_PROMPT } from "./prompts.ts";
import { StrategyError } from "./strategy.errors.ts";
import type { Metrics, TraceEvent } from "./strategy.schema.ts";
import { DEFAULT_MAX_ITERATIONS, type ReasoningStrategy, type StrategyDeps } from "./strategy.types.ts";
import { lastText, messagesToTrace } from "./trace-capture.ts";
import { createTools } from "./tools.ts";

export function createReactStrategy({ model, store }: StrategyDeps): ReasoningStrategy {
  return {
    name: "react",
    async run(input, options = {}) {
      const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
      const started = Date.now();
      const counter = new LlmCallCounter();
      const metrics = (): Metrics => ({ llmCalls: counter.count, latencyMs: Date.now() - started });

      const agent = createReactAgent({ llm: model, tools: createTools(store), prompt: OPS_SYSTEM_PROMPT });
      let messages: BaseMessage[] = [];
      let limitHit = false;
      try {
        const stream = await agent.stream(
          { messages: [{ role: "user", content: input }] },
          { recursionLimit: recursionLimitFor(maxIterations), callbacks: [counter], streamMode: "values" },
        );
        for await (const state of stream) messages = state.messages;
      } catch (error) {
        if (!(error instanceof GraphRecursionError)) {
          const message = error instanceof Error ? error.message : String(error);
          throw new StrategyError(message, { trace: messagesToTrace(messages), metrics: metrics() }, { cause: error });
        }
        limitHit = true;
      }

      const trace: TraceEvent[] = messagesToTrace(messages);
      let answer = lastText(messages);
      if (limitHit) {
        const note = `Iteration limit (${maxIterations}) reached before a final answer.`;
        answer = answer ? `${answer}\n(partial: ${note})` : `Partial result: ${note}`;
        trace.push({ type: "critique", text: note });
        trace.push({ type: "answer", text: answer });
      }
      return { answer, trace, metrics: metrics() };
    },
  };
}
