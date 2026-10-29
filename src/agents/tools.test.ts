import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryStore } from "../store/memory-store.ts";
import { AlertView } from "./tools.schema.ts";
import { createToolset } from "./tools.ts";

function setup() {
  const store = new MemoryStore();
  return { store, ...createToolset(store) };
}

const parse = (out: unknown) => AlertView.array().parse(JSON.parse(String(out)));

describe("list_alerts", () => {
  it("returns the 3 firing alerts with service names", async () => {
    const alerts = parse(await setup().listAlerts.invoke({ status: "firing" }));
    assert.equal(alerts.length, 3);
    assert.ok(alerts.every((a) => a.status === "firing"));
    assert.ok(alerts.some((a) => a.service === "payments-gateway"));
  });

  it("returns the 3 resolved alerts", async () => {
    const alerts = parse(await setup().listAlerts.invoke({ status: "resolved" }));
    assert.equal(alerts.length, 3);
  });

  it("returns all 6 alerts for status all", async () => {
    assert.equal(parse(await setup().listAlerts.invoke({ status: "all" })).length, 6);
  });

  it("defaults to firing", async () => {
    const alerts = parse(await setup().listAlerts.invoke({}));
    assert.equal(alerts.length, 3);
  });

  it("rejects an invalid status", async () => {
    await assert.rejects(setup().listAlerts.invoke(JSON.parse(`{"status":"bogus"}`)), /status/);
  });
});

const errorOf = (out: unknown) => (JSON.parse(String(out)) as { error?: string }).error;

describe("open_incident", () => {
  it("opens an incident visible in the store", async () => {
    const t = setup();
    const out = JSON.parse(String(await t.openIncident.invoke({ title: "Checkout down", service: "checkout-api", severity: "high" })));
    assert.match(out.id, /^inc-\d+$/);
    assert.equal(out.state, "open");
    assert.equal((await t.store.listIncidents()).length, 1);
  });

  it("returns an error for an unknown service and changes nothing", async () => {
    const t = setup();
    const out = await t.openIncident.invoke({ title: "x", service: "nope", severity: "low" });
    assert.match(errorOf(out) ?? "", /Unknown service/);
    assert.equal((await t.store.listIncidents()).length, 0);
  });

  it("rejects an invalid severity and an empty title", async () => {
    const t = setup();
    await assert.rejects(t.openIncident.invoke(JSON.parse(`{"title":"x","service":"checkout-api","severity":"urgent"}`)), /severity/);
    await assert.rejects(t.openIncident.invoke({ title: " ", service: "checkout-api", severity: "low" }), /title/);
    assert.equal((await t.store.listIncidents()).length, 0);
  });
});

describe("resolve_incident", () => {
  it("resolves once and reports a repeat", async () => {
    const t = setup();
    const opened = JSON.parse(String(await t.openIncident.invoke({ title: "t", service: "auth-service", severity: "medium" })));
    const resolved = JSON.parse(String(await t.resolveIncident.invoke({ id: opened.id })));
    assert.equal(resolved.state, "resolved");
    assert.match(errorOf(await t.resolveIncident.invoke({ id: opened.id })) ?? "", /already resolved/i);
  });

  it("returns an error for an unknown id", async () => {
    assert.match(errorOf(await setup().resolveIncident.invoke({ id: "inc-404" })) ?? "", /Unknown incident/);
  });
});
