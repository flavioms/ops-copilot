import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MemoryStore } from "./memory-store.ts";
import { readSeed } from "./seed-data.ts";
import { StoreData, type Incident, type OpenIncidentInput } from "./store.schema.ts";

export const DEFAULT_DB_FILE = fileURLToPath(new URL("../../data/db.json", import.meta.url));

function writeStoreFile(path: string, data: StoreData) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, JSON.stringify(StoreData.parse(data), null, 2) + "\n");
  renameSync(temp, path);
}

/**
 * A MemoryStore whose content lives in a JSON file: the file is read when the store is opened
 * and rewritten after every successful change, so incidents survive between runs.
 */
export class JsonFileStore extends MemoryStore {
  private readonly path: string;

  private constructor(path: string, data: StoreData) {
    super(data);
    this.path = path;
  }

  /** Creates (or overwrites) the file from data/seed.json and opens it. */
  static seed(path: string = DEFAULT_DB_FILE): JsonFileStore {
    const data = readSeed();
    writeStoreFile(path, data);
    return new JsonFileStore(path, data);
  }

  /** Opens an existing file; fails if it is missing or not a valid store. */
  static open(path: string = DEFAULT_DB_FILE): JsonFileStore {
    if (!existsSync(path)) throw new Error(`Database file not found: ${path}. Run \`npm run seed\` first.`);
    return new JsonFileStore(path, StoreData.parse(JSON.parse(readFileSync(path, "utf8"))));
  }

  override async openIncident(input: OpenIncidentInput): Promise<Incident> {
    const incident = await super.openIncident(input);
    writeStoreFile(this.path, this.snapshot());
    return incident;
  }

  override async resolveIncident(id: string): Promise<Incident> {
    const incident = await super.resolveIncident(id);
    writeStoreFile(this.path, this.snapshot());
    return incident;
  }
}
