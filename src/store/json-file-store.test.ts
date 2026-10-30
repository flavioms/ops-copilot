import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { JsonFileStore } from "./json-file-store.ts";
import { readSeed } from "./seed-data.ts";
import { StoreData } from "./store.schema.ts";
import { runStoreContract } from "./store.contract.ts";

const dir = mkdtempSync(join(tmpdir(), "ops-json-store-"));
after(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;
const freshPath = () => join(dir, `db-${counter++}.json`);

runStoreContract("json-file", async () => JsonFileStore.seed(freshPath()));

describe("JsonFileStore", () => {
  it("seed() writes the seed data as a valid store file", () => {
    const path = freshPath();
    JsonFileStore.seed(path);
    const data = StoreData.parse(JSON.parse(readFileSync(path, "utf8")));
    assert.deepEqual(data, readSeed());
  });

  it("seed() is idempotent: seeding again discards earlier incidents", async () => {
    const path = freshPath();
    const store = JsonFileStore.seed(path);
    await store.openIncident({ title: "x", service: "checkout-api", severity: "low" });
    const again = JsonFileStore.seed(path);
    assert.equal((await again.listIncidents()).length, 0);
    assert.equal((await again.listAlerts()).length, 6);
  });

  it("persists new incidents so a later process reads them", async () => {
    const path = freshPath();
    const first = JsonFileStore.seed(path);
    const opened = await first.openIncident({ title: "Checkout down", service: "checkout-api", severity: "high" });
    const second = JsonFileStore.open(path);
    assert.deepEqual((await second.listIncidents()).map((i) => i.id), [opened.id]);
    const next = await second.openIncident({ title: "Another", service: "auth-service", severity: "low" });
    assert.notEqual(next.id, opened.id);
  });

  it("persists resolution", async () => {
    const path = freshPath();
    const store = JsonFileStore.seed(path);
    const { id } = await store.openIncident({ title: "t", service: "auth-service", severity: "medium" });
    await store.resolveIncident(id);
    assert.equal((await JsonFileStore.open(path).listIncidents())[0]?.state, "resolved");
  });

  it("does not write when a call is rejected", async () => {
    const path = freshPath();
    const store = JsonFileStore.seed(path);
    const before = readFileSync(path, "utf8");
    await assert.rejects(store.openIncident({ title: "x", service: "nope", severity: "low" }));
    assert.equal(readFileSync(path, "utf8"), before);
  });

  it("open() fails with a hint to run the seed when the file is missing", () => {
    const path = freshPath();
    assert.equal(existsSync(path), false);
    assert.throws(() => JsonFileStore.open(path), /npm run seed/);
  });

  it("open() rejects a file that is not a valid store", async () => {
    const path = freshPath();
    JsonFileStore.seed(path);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path, JSON.stringify({ services: [] }));
    assert.throws(() => JsonFileStore.open(path));
  });
});
