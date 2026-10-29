# Contract: ReasoningStrategy

```ts
interface ReasoningStrategy {
  readonly name: "react" | "plan-and-execute";
  run(input: string, options?: RunOptions): Promise<RunResult>;
}
interface RunOptions { maxIterations?: number /* default 10, integer ≥ 1 */ }
```

Guarantees (tested):
- Always resolves with `RunResult` (answer, ordered trace, metrics), including when the iteration
  limit is hit (trace has a `critique` limit notice; answer states it is partial) or a tool errors
  (error appears as an `observation`).
- Trace ends with an `answer` event.
- `metrics.llmCalls` equals actual model invocations, including sub-runs; `latencyMs` is wall time.
- Model/setup failures (missing env, unreachable service) reject with an `Error` whose message
  names the cause; partial trace/metrics are attached to the error as `partial`.
- An iteration is one model call plus the tool step that follows it. ReAct stops after at most
  `maxIterations` model calls.
- Plan-and-Execute treats `maxIterations` as ONE total budget for executor iterations across all
  steps (planner and replanner calls are counted in `llmCalls` but not as iterations), and never
  executes more than 8 steps.
