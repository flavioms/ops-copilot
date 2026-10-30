import { readFileSync } from "node:fs";
import { StoreData } from "./store.schema.ts";

export const SEED_FILE = new URL("../../data/seed.json", import.meta.url);

/** Reads and validates data/seed.json (5 services, 6 alerts). Each call returns a fresh copy. */
export function readSeed(): StoreData {
  return StoreData.parse(JSON.parse(readFileSync(SEED_FILE, "utf8")));
}
