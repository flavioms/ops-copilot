import type { ReasoningStrategy } from "./agents/strategy.types.ts";

export interface ArenaDeps {
  /** Called once per selected strategy, so each one can get its own clean store. */
  createStrategy: (name: ReasoningStrategy["name"]) => Promise<ReasoningStrategy>;
  write: (text: string) => void;
}
