import { readDatabaseUrl } from "../src/db.schema.ts";
import { DEFAULT_DB_FILE, JsonFileStore } from "../src/store/json-file-store.ts";
import { SequelizeStore } from "../src/store/sequelize-store.ts";
import type { AlertStore } from "../src/store/store.types.ts";

async function describeStore(label: string, store: AlertStore) {
  const [services, alerts] = await Promise.all([store.listServices(), store.listAlerts()]);
  const firing = alerts.filter((a) => a.status === "firing").length;
  console.log(`${label}: ${services.length} services, ${alerts.length} alerts (${firing} firing, ${alerts.length - firing} resolved)`);
}

// Primary database for now: the JSON file (data/db.json), rebuilt from data/seed.json.
await describeStore(`seeded ${DEFAULT_DB_FILE}`, JsonFileStore.seed());

// PostgreSQL is optional: seeded too only when DATABASE_URL is set.
if (process.env.DATABASE_URL) {
  const postgres = new SequelizeStore(readDatabaseUrl());
  try {
    await postgres.reset();
    await describeStore("seeded PostgreSQL", postgres);
  } finally {
    await postgres.close();
  }
}
