import type { ReasoningStrategy } from "./agents/strategy.types.ts";

export interface ArenaDeps {
  strategies: Record<ReasoningStrategy["name"], ReasoningStrategy>;
  write: (text: string) => void;
}
