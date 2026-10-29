import { z } from "zod";

export const TraceEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("thought"), text: z.string() }),
  z.object({ type: z.literal("action"), tool: z.string(), args: z.record(z.string(), z.unknown()) }),
  z.object({ type: z.literal("observation"), tool: z.string(), content: z.string() }),
  z.object({ type: z.literal("plan"), steps: z.array(z.string()) }),
  z.object({ type: z.literal("critique"), text: z.string() }),
  z.object({ type: z.literal("answer"), text: z.string() }),
]);

export const Metrics = z.object({
  llmCalls: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative(),
});

export const RunResult = z.object({
  answer: z.string(),
  trace: z.array(TraceEvent),
  metrics: Metrics,
});

export type TraceEvent = z.infer<typeof TraceEvent>;
export type Metrics = z.infer<typeof Metrics>;
export type RunResult = z.infer<typeof RunResult>;
