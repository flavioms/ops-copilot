import { readDatabaseUrl } from "../src/db.schema.ts";
import { SequelizeStore } from "../src/store/sequelize-store.ts";

const store = new SequelizeStore(readDatabaseUrl());
try {
  await store.reset();
  const [services, alerts] = await Promise.all([store.listServices(), store.listAlerts()]);
  const firing = alerts.filter((a) => a.status === "firing").length;
  console.log(`seeded ${services.length} services, ${alerts.length} alerts (${firing} firing, ${alerts.length - firing} resolved)`);
} finally {
  await store.close();
}
