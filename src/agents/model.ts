import { ChatOpenAI } from "@langchain/openai";
import { ModelEnv, OPENROUTER_BASE_URL } from "./model.schema.ts";

/** Single place that builds the LLM client (OpenRouter, deterministic). */
export function createModel(env: Record<string, string | undefined> = process.env) {
  const parsed = ModelEnv.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or empty environment variable(s): ${missing}`);
  }
  return new ChatOpenAI({
    model: parsed.data.OPENROUTER_MODEL,
    apiKey: parsed.data.OPENROUTER_API_KEY,
    configuration: { baseURL: OPENROUTER_BASE_URL },
    temperature: 0,
  });
}
