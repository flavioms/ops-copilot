import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { SequelizeStore } from "./sequelize-store.ts";
import { runStoreContract } from "./store.contract.ts";

const url = process.env.TEST_DATABASE_URL;

if (!url) {
  describe("AlertStore contract: sequelize", () => {
    it("requires TEST_DATABASE_URL", { skip: "TEST_DATABASE_URL not set" }, () => {});
  });
} else {
  const stores: SequelizeStore[] = [];
  after(async () => {
    await Promise.all(stores.map((s) => s.close()));
  });

  runStoreContract("sequelize", async () => {
    const store = new SequelizeStore(url);
    stores.push(store);
    await store.reset();
    return store;
  });

  describe("seed reset", () => {
    it("is idempotent: repeated resets leave 5 services and 6 alerts", async () => {
      const store = new SequelizeStore(url);
      stores.push(store);
      await store.reset();
      await store.reset();
      assert.equal((await store.listServices()).length, 5);
      assert.equal((await store.listAlerts()).length, 6);
    });
  });
}
