import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readSeed } from "./seed-data.ts";

describe("readSeed", () => {
  it("loads the validated JSON seed: 5 services, 6 alerts (3 firing, 3 resolved), no incidents", () => {
    const seed = readSeed();
    assert.equal(seed.services.length, 5);
    assert.equal(seed.alerts.length, 6);
    assert.equal(seed.alerts.filter((a) => a.status === "firing").length, 3);
    assert.equal(seed.incidents.length, 0);
  });

  it("returns an independent copy each time", () => {
    const first = readSeed();
    first.services.pop();
    assert.equal(readSeed().services.length, 5);
  });
});
