import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlreadyResolved, UnknownIncident, UnknownService } from "./store.errors.ts";
import type { AlertStore } from "./store.types.ts";

/** Behavior every AlertStore implementation must satisfy (FR-014, FR-015). */
export function runStoreContract(name: string, makeStore: () => Promise<AlertStore>) {
  describe(`AlertStore contract: ${name}`, () => {
    it("is seeded with 5 services and 6 alerts", async () => {
      const store = await makeStore();
      assert.equal((await store.listServices()).length, 5);
      assert.equal((await store.listAlerts()).length, 6);
    });

    it("filters alerts by status", async () => {
      const store = await makeStore();
      const firing = await store.listAlerts("firing");
      const resolved = await store.listAlerts("resolved");
      assert.equal(firing.length, 3);
      assert.equal(resolved.length, 3);
      assert.ok(firing.every((a) => a.status === "firing"));
      assert.ok(resolved.every((a) => a.status === "resolved"));
    });

    it("finds a service by name or id", async () => {
      const store = await makeStore();
      assert.equal((await store.findService("checkout-api"))?.id, "svc-1");
      assert.equal((await store.findService("svc-2"))?.name, "payments-gateway");
      assert.equal(await store.findService("nope"), undefined);
    });

    it("opens an incident and lists it", async () => {
      const store = await makeStore();
      const incident = await store.openIncident({ title: "Checkout down", service: "checkout-api", severity: "high" });
      assert.equal(incident.state, "open");
      assert.match(incident.id, /^inc-\d+$/);
      assert.equal(incident.serviceId, "svc-1");
      assert.deepEqual((await store.listIncidents()).map((i) => i.id), [incident.id]);
    });

    it("rejects an unknown service without changing state", async () => {
      const store = await makeStore();
      await assert.rejects(
        store.openIncident({ title: "x", service: "nope", severity: "low" }),
        UnknownService,
      );
      assert.equal((await store.listIncidents()).length, 0);
    });

    it("resolves an incident once", async () => {
      const store = await makeStore();
      const { id } = await store.openIncident({ title: "t", service: "auth-service", severity: "medium" });
      const resolved = await store.resolveIncident(id);
      assert.equal(resolved.state, "resolved");
      assert.ok(resolved.resolvedAt);
      await assert.rejects(store.resolveIncident(id), AlreadyResolved);
    });

    it("rejects resolving an unknown incident", async () => {
      const store = await makeStore();
      await assert.rejects(store.resolveIncident("inc-999"), UnknownIncident);
    });
  });
}
