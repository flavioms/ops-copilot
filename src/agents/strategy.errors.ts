import type { Metrics, TraceEvent } from "./strategy.schema.ts";

/** A run that failed after producing some trace and metrics (model unreachable, invalid plan, ...). */
export class StrategyError extends Error {
  readonly partial: { trace: TraceEvent[]; metrics: Metrics };

  constructor(message: string, partial: { trace: TraceEvent[]; metrics: Metrics }, options?: ErrorOptions) {
    super(message, options);
    this.name = "StrategyError";
    this.partial = partial;
  }
}
