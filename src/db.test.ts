import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readDatabaseUrl } from "./db.schema.ts";

describe("readDatabaseUrl", () => {
  it("returns a valid postgres url", () => {
    assert.equal(readDatabaseUrl({ DATABASE_URL: "postgres://u:p@localhost:5432/db" }), "postgres://u:p@localhost:5432/db");
  });

  it("names the variable when missing", () => {
    assert.throws(() => readDatabaseUrl({}), /DATABASE_URL/);
  });

  it("rejects other schemes", () => {
    assert.throws(() => readDatabaseUrl({ DATABASE_URL: "mysql://localhost/db" }), /DATABASE_URL/);
  });
});
