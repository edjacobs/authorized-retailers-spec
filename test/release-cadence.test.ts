import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { cadenceProblem, headline } from "../scripts/check-release-cadence.mjs";

const DAY = 86_400_000;
const at = (iso: string) => Date.parse(iso);
const tags = [
  { version: "0.1.0", date: at("2026-09-20T12:00:00Z") },
  { version: "0.1.1", date: at("2026-09-26T12:00:00Z") },
  { version: "0.2.0", date: at("2026-09-28T12:00:00Z") },
];

describe("release cadence", () => {
  it("headline is 0.minor before 1.0, then the major", () => {
    expect(headline("0.2.3")).toBe("0.2");
    expect(headline("v1.4.0")).toBe("1");
  });

  it("allows patches any time", () => {
    expect(cadenceProblem("0.2.1", tags, at("2026-09-29T00:00:00Z"))).toBeNull();
  });

  it("refuses a headline change within 30 days of the last one", () => {
    expect(cadenceProblem("0.3.0", tags, at("2026-10-20T00:00:00Z"))).toMatch(/on or after 2026-10-28/);
  });

  it("allows a headline change after 30 days, counted from the headline's first release", () => {
    const withPatch = [...tags, { version: "0.2.5", date: at("2026-10-27T00:00:00Z") }];
    expect(cadenceProblem("0.3.0", withPatch, at("2026-10-28T12:00:00Z"))).toBeNull();
    expect(cadenceProblem("1.0.0", withPatch, at("2026-10-28T12:00:00Z") - DAY)).not.toBeNull();
  });

  it("ignores the tag being released and allows the first release", () => {
    const tagged = [...tags, { version: "0.2.1", date: at("2026-09-29T00:00:00Z") }];
    expect(cadenceProblem("0.2.1", tagged, at("2026-09-29T00:05:00Z"))).toBeNull();
    // 0.2.0 itself came 8 days after 0.1.0, which this rule would now refuse.
    expect(cadenceProblem("0.2.0", tags, at("2026-09-28T13:00:00Z"))).toMatch(/0\.1 was first released 8 days ago/);
    expect(cadenceProblem("0.1.0", [], Date.now())).toBeNull();
  });
});
