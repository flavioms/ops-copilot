import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AlertStore } from "../store/store.types.ts";
import type { RunResult } from "./strategy.schema.ts";

export interface RunOptions {
  /** Maximum reasoning iterations. Integer >= 1, default 10. */
  maxIterations?: number;
}

export interface ReasoningStrategy {
  readonly name: "react" | "plan-and-execute";
  run(input: string, options?: RunOptions): Promise<RunResult>;
}

export const DEFAULT_MAX_ITERATIONS = 10;

/** Dependencies injected into every strategy so tests can stub the model and the store. */
export interface StrategyDeps {
  model: BaseChatModel;
  store: AlertStore;
}
