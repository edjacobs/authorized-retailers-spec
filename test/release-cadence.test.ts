import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { cadenceProblem, major } from "../scripts/check-release-cadence.mjs";

const DAY = 86_400_000;
const at = (iso: string) => Date.parse(iso);
const tags = [
  { version: "0.1.0", date: at("2026-09-20T12:00:00Z") },
  { version: "0.1.1", date: at("2026-09-26T12:00:00Z") },
  { version: "0.2.0", date: at("2026-09-28T12:00:00Z") },
];

describe("release cadence", () => {
  it("the rule counts the major version only", () => {
    expect(major("0.2.3")).toBe("0");
    expect(major("v1.4.0")).toBe("1");
  });

  it("allows minor and patch releases any time", () => {
    expect(cadenceProblem("0.2.1", tags, at("2026-09-29T00:00:00Z"))).toBeNull();
    expect(cadenceProblem("0.3.0", tags, at("2026-09-29T00:00:00Z"))).toBeNull();
  });

  it("refuses a major change within 30 days of the last one, counted from its first release", () => {
    const v1 = [...tags, { version: "1.0.0", date: at("2026-11-01T00:00:00Z") }, { version: "1.1.0", date: at("2026-11-20T00:00:00Z") }];
    expect(cadenceProblem("2.0.0", v1, at("2026-11-25T00:00:00Z"))).toMatch(/on or after 2026-12-01/);
    expect(cadenceProblem("2.0.0", v1, at("2026-12-01T00:00:00Z"))).toBeNull();
  });

  it("counts 0.x as one major version", () => {
    // 0.x started 2026-09-20, so 1.0.0 is allowed from 2026-10-20.
    expect(cadenceProblem("1.0.0", tags, at("2026-10-19T00:00:00Z") - DAY)).toMatch(/on or after 2026-10-20/);
    expect(cadenceProblem("1.0.0", tags, at("2026-10-20T12:00:00Z"))).toBeNull();
  });

  it("ignores the tag being released and allows the first release", () => {
    const tagged = [...tags, { version: "0.2.1", date: at("2026-09-29T00:00:00Z") }];
    expect(cadenceProblem("0.2.1", tagged, at("2026-09-29T00:05:00Z"))).toBeNull();
    expect(cadenceProblem("0.1.0", [], Date.now())).toBeNull();
  });
});
