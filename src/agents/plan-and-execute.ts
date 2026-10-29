import type { BaseMessage } from "@langchain/core/messages";
import { END, GraphRecursionError, START, StateGraph } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { LlmCallCounter } from "./llm-call-counter.ts";
import { MAX_PLAN_STEPS, Plan, PlanState, Replan, type PlanStateType } from "./plan-and-execute.schema.ts";
import { EXECUTOR_PROMPT, PLANNER_PROMPT, REPLANNER_PROMPT } from "./prompts.ts";
import { recursionLimitFor } from "./iteration-limit.ts";
import { StrategyError } from "./strategy.errors.ts";
import type { Metrics, TraceEvent } from "./strategy.schema.ts";
import { DEFAULT_MAX_ITERATIONS, type ReasoningStrategy, type StrategyDeps } from "./strategy.types.ts";
import { createTools } from "./tools.ts";
import { lastText, messagesToTrace } from "./trace-capture.ts";

const history = (state: PlanStateType) =>
  state.past.map((p, i) => `${i + 1}. ${p.step}\n   Result: ${p.result}`).join("\n") || "(nothing done yet)";

export function createPlanAndExecuteStrategy({ model, store }: StrategyDeps): ReasoningStrategy {
  return {
    name: "plan-and-execute",
    async run(input, options = {}) {
      const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
      const started = Date.now();
      const counter = new LlmCallCounter();
      const metrics = (): Metrics => ({ llmCalls: counter.count, latencyMs: Date.now() - started });
      const callbacks = [counter];
      const tools = createTools(store);

      const planner = async (state: PlanStateType) => {
        const { steps } = await model
          .withStructuredOutput(Plan)
          .invoke([["system", PLANNER_PROMPT], ["human", state.input]], { callbacks });
        const kept = steps.slice(0, MAX_PLAN_STEPS);
        const trace: TraceEvent[] = [{ type: "plan", steps: kept }];
        if (kept.length < steps.length) {
          trace.push({ type: "critique", text: `Plan truncated from ${steps.length} to ${MAX_PLAN_STEPS} steps.` });
        }
        return { plan: kept, trace };
      };

      const executor = async (state: PlanStateType) => {
        const [step = "", ...rest] = state.plan;
        const local = new LlmCallCounter();
        const agent = createReactAgent({ llm: model, tools, prompt: EXECUTOR_PROMPT });
        const task = `Objective: ${state.input}\nDone so far:\n${history(state)}\nCurrent step: ${step}`;
        let messages: BaseMessage[] = [];
        let limitHit = false;
        try {
          const stream = await agent.stream(
            { messages: [{ role: "user", content: task }] },
            {
              recursionLimit: recursionLimitFor(Math.max(1, maxIterations - state.iterationsUsed)),
              callbacks: [counter, local],
              streamMode: "values",
            },
          );
          for await (const s of stream) messages = s.messages;
        } catch (error) {
          if (!(error instanceof GraphRecursionError)) throw error;
          limitHit = true;
        }
        const result = lastText(messages) || (limitHit ? "No result before the iteration limit." : "No result.");
        // The sub-run's closing text is the step result, not the final answer.
        const trace = messagesToTrace(messages).map((e): TraceEvent =>
          e.type === "answer" ? { type: "thought", text: `Step result: ${e.text}` } : e);
        if (limitHit) trace.push({ type: "thought", text: `Step result: ${result}` });
        return {
          plan: rest,
          past: [{ step, result }],
          trace,
          iterationsUsed: state.iterationsUsed + Math.max(local.count, 1),
          stopReason: limitHit ? `Iteration limit (${maxIterations}) reached.` : "",
        };
      };

      const replanner = async (state: PlanStateType) => {
        const prompt = `Objective: ${state.input}\nSteps done:\n${history(state)}\nRemaining plan: ${JSON.stringify(state.plan)}`;
        const replan = await model
          .withStructuredOutput(Replan)
          .invoke([["system", REPLANNER_PROMPT], ["human", prompt]], { callbacks });
        const finished = replan.done || replan.remaining.length === 0;
        const trace: TraceEvent[] = [{ type: "critique", text: replan.rationale }];
        if (!finished) trace.push({ type: "plan", steps: replan.remaining });
        const last = state.past.at(-1)?.result ?? "";
        return {
          plan: finished ? [] : replan.remaining,
          trace,
          done: finished,
          answer: finished ? (replan.answer?.trim() || last) : "",
        };
      };

      const finalize = (state: PlanStateType) => {
        const reason =
          state.stopReason ||
          (state.done ? "" : state.past.length >= MAX_PLAN_STEPS ? `Reached the maximum of ${MAX_PLAN_STEPS} steps.` : "") ||
          (state.done ? "" : `Iteration limit (${maxIterations}) reached.`);
        const base = state.answer || state.past.at(-1)?.result || "";
        const answer = reason ? `${base}\n(partial: ${reason})`.trim() : base;
        const trace: TraceEvent[] = reason ? [{ type: "critique", text: reason }] : [];
        trace.push({ type: "answer", text: answer });
        return { answer, trace };
      };

      const afterExecutor = (s: PlanStateType) => (s.stopReason ? "finalize" : "replanner");
      const afterReplanner = (s: PlanStateType) => {
        if (s.done) return "finalize";
        if (s.past.length >= MAX_PLAN_STEPS) return "finalize";
        if (s.iterationsUsed >= maxIterations) return "finalize";
        return "executor";
      };

      const graph = new StateGraph(PlanState)
        .addNode("planner", planner)
        .addNode("executor", executor)
        .addNode("replanner", replanner)
        .addNode("finalize", finalize)
        .addEdge(START, "planner")
        .addEdge("planner", "executor")
        .addConditionalEdges("executor", afterExecutor, ["finalize", "replanner"])
        .addConditionalEdges("replanner", afterReplanner, ["finalize", "executor"])
        .addEdge("finalize", END)
        .compile();

      let state: PlanStateType | undefined;
      try {
        const stream = await graph.stream({ input }, { recursionLimit: 100, streamMode: "values" });
        for await (const s of stream) state = s;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new StrategyError(message, { trace: state?.trace ?? [], metrics: metrics() }, { cause: error });
      }
      return { answer: state?.answer ?? "", trace: state?.trace ?? [], metrics: metrics() };
    },
  };
}
