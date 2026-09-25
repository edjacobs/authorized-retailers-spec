import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM script without types
import { renderSchemasModule } from "../scripts/embed-schemas.mjs";

describe("src/schemas.ts", () => {
  it("matches schemas/*.json (run node scripts/embed-schemas.mjs after changing a schema)", () => {
    expect(readFileSync(new URL("../src/schemas.ts", import.meta.url), "utf8")).toBe(renderSchemasModule());
  });
});
