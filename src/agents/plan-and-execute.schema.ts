import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
import type { TraceEvent } from "./strategy.schema.ts";

export const MAX_PLAN_STEPS = 8;

export const Plan = z.object({
  steps: z.array(z.string().min(1)).min(1),
});

export const Replan = z.object({
  done: z.boolean(),
  remaining: z.array(z.string().min(1)),
  rationale: z.string(),
  answer: z.string().optional(),
});

export interface StepResult {
  step: string;
  result: string;
}

const append = <T>() => Annotation<T[]>({ reducer: (a, b) => a.concat(b), default: () => [] });

export const PlanState = Annotation.Root({
  input: Annotation<string>(),
  plan: Annotation<string[]>({ reducer: (_, b) => b, default: () => [] }),
  past: append<StepResult>(),
  trace: append<TraceEvent>(),
  iterationsUsed: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  done: Annotation<boolean>({ reducer: (_, b) => b, default: () => false }),
  stopReason: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  answer: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
});

export type Plan = z.infer<typeof Plan>;
export type Replan = z.infer<typeof Replan>;
export type PlanStateType = typeof PlanState.State;
