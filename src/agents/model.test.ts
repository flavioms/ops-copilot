import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createModel } from "./model.ts";

describe("createModel", () => {
  it("names OPENROUTER_API_KEY when missing", () => {
    assert.throws(() => createModel({ OPENROUTER_MODEL: "m" }), /OPENROUTER_API_KEY/);
  });

  it("names OPENROUTER_MODEL when missing", () => {
    assert.throws(() => createModel({ OPENROUTER_API_KEY: "k" }), /OPENROUTER_MODEL/);
  });

  it("configures temperature 0 and the OpenRouter base URL", () => {
    const model = createModel({ OPENROUTER_API_KEY: "k", OPENROUTER_MODEL: "some/model" });
    assert.equal(model.temperature, 0);
    assert.equal(model.model, "some/model");
    assert.equal(model.clientConfig.baseURL, "https://openrouter.ai/api/v1");
  });
});
