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
- Plan-and-Execute never executes more than `min(8, maxIterations)` steps.
