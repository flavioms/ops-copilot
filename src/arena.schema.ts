import { z } from "zod";

export const STRATEGY_NAMES = ["react", "plan-and-execute"] as const;

export const ArenaArgs = z.object({
  strategies: z
    .string()
    .default(STRATEGY_NAMES.join(","))
    .transform((csv) => csv.split(",").map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.enum(STRATEGY_NAMES)).min(1)),
  maxIterations: z.coerce.number().int().min(1).default(10),
  request: z.string().trim().min(1, "a request is required"),
});

export type ArenaArgs = z.infer<typeof ArenaArgs>;
