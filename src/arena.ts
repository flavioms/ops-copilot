import { parseArgs } from "node:util";
import { createModel } from "./agents/model.ts";
import { createPlanAndExecuteStrategy } from "./agents/plan-and-execute.ts";
import { createReactStrategy } from "./agents/react.ts";
import { StrategyError } from "./agents/strategy.errors.ts";
import type { Metrics } from "./agents/strategy.schema.ts";
import { formatTrace } from "./agents/trace-format.ts";
import { ArenaArgs, STRATEGY_NAMES } from "./arena.schema.ts";
import type { ArenaDeps } from "./arena.types.ts";
import { readDatabaseUrl } from "./db.schema.ts";
import { MemoryStore } from "./store/memory-store.ts";
import { SequelizeStore } from "./store/sequelize-store.ts";
import type { AlertStore } from "./store/store.types.ts";

export function parseArenaArgs(argv: string[]): ArenaArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { strategies: { type: "string" }, "max-iterations": { type: "string" } },
  });
  const unknown = (values.strategies ?? "").split(",").map((s) => s.trim()).filter((s) => s && !STRATEGY_NAMES.some((n) => n === s));
  if (unknown.length > 0) {
    throw new Error(`Unknown strategy: ${unknown.join(", ")}. Valid strategies: ${STRATEGY_NAMES.join(", ")}`);
  }
  const parsed = ArenaArgs.safeParse({
    strategies: values.strategies,
    maxIterations: values["max-iterations"],
    request: positionals.join(" "),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] === "maxIterations" ? "--max-iterations" : String(issue?.path[0] ?? "arguments");
    throw new Error(`Invalid ${field}: ${issue?.message ?? "invalid value"}`);
  }
  return parsed.data;
}

const metricsLine = (m: Metrics) => `llmCalls=${m.llmCalls} latencyMs=${m.latencyMs}`;

/** Runs the selected strategies on the same request and prints each result. Returns the exit code. */
export async function runArena(argv: string[], { strategies, write }: ArenaDeps): Promise<number> {
  let args: ArenaArgs;
  try {
    args = parseArenaArgs(argv);
  } catch (error) {
    write(error instanceof Error ? error.message : String(error));
    return 1;
  }
  let failed = false;
  for (const name of args.strategies) {
    write(`=== ${name} ===`);
    try {
      const result = await strategies[name].run(args.request, { maxIterations: args.maxIterations });
      write(formatTrace(result.trace));
      write(`Answer: ${result.answer}`);
      write(metricsLine(result.metrics));
    } catch (error) {
      failed = true;
      write(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof StrategyError) {
        write(formatTrace(error.partial.trace));
        write(metricsLine(error.partial.metrics));
      }
    }
  }
  return failed ? 1 : 0;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ? readDatabaseUrl() : undefined;
  const sequelizeStore = databaseUrl ? new SequelizeStore(databaseUrl) : undefined;
  const store: AlertStore = sequelizeStore ?? new MemoryStore();
  try {
    const model = createModel();
    const code = await runArena(process.argv.slice(2), {
      strategies: {
        react: createReactStrategy({ model, store }),
        "plan-and-execute": createPlanAndExecuteStrategy({ model, store }),
      },
      write: (text) => console.log(text),
    });
    process.exitCode = code;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await sequelizeStore?.close();
  }
}

if (import.meta.main) await main();
