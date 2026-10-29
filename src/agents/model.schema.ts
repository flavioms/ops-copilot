import { z } from "zod";

export const ModelEnv = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1),
});

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
