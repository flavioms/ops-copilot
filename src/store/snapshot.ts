import type { StoreData } from "./store.schema.ts";
import type { AlertStore } from "./store.types.ts";

/** Reads the whole content of any AlertStore, so a MemoryStore can be started from it. */
export async function snapshotStore(store: AlertStore): Promise<StoreData> {
  const [services, alerts, incidents] = await Promise.all([
    store.listServices(),
    store.listAlerts(),
    store.listIncidents(),
  ]);
  return { services, alerts, incidents };
}
