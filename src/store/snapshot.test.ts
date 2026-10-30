import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryStore } from "./memory-store.ts";
import { snapshotStore } from "./snapshot.ts";

describe("snapshotStore", () => {
  it("captures services, alerts and incidents of any AlertStore", async () => {
    const store = new MemoryStore();
    const incident = await store.openIncident({ title: "t", service: "checkout-api", severity: "low" });
    const data = await snapshotStore(store);
    assert.equal(data.services.length, 5);
    assert.equal(data.alerts.length, 6);
    assert.deepEqual(data.incidents.map((i) => i.id), [incident.id]);
  });

  it("gives each MemoryStore built from it an isolated state", async () => {
    const data = await snapshotStore(new MemoryStore());
    const a = new MemoryStore(data);
    const b = new MemoryStore(data);
    await a.openIncident({ title: "only in a", service: "auth-service", severity: "high" });
    assert.equal((await a.listIncidents()).length, 1);
    assert.equal((await b.listIncidents()).length, 0);
  });
});
