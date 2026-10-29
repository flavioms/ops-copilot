import { z } from "zod";

export const DatabaseEnv = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must start with postgres:// or postgresql://"),
});

export function readDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  const parsed = DatabaseEnv.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid DATABASE_URL: ${parsed.error.issues[0]?.message ?? "missing"}`);
  }
  return parsed.data.DATABASE_URL;
}
