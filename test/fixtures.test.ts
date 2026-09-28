import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  matchRequest,
  normalizeVerifyRequest,
  validateFile,
  validateList,
  validateRevocationFeed,
  validateVerifyRequest,
  validateVerifyResponse,
  type PublicList,
  type ValidationResult,
  type VerifyRequest,
} from "../src";

const root = join(import.meta.dirname, "..", "fixtures");
type Kind = "pointer" | "list" | "verify-request" | "verify-response" | "revocation-feed" | "match";
interface Entry { path: string; kind: Kind; valid?: boolean; expect?: string; fetched_from?: string; note?: string }
const manifest: Entry[] = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

const validators: Record<Exclude<Kind, "match">, (x: unknown, e: Entry) => ValidationResult<unknown>> = {
  pointer: (x, e) => validateFile(x, e.fetched_from),
  list: validateList,
  "verify-request": validateVerifyRequest,
  "verify-response": validateVerifyResponse,
  "revocation-feed": validateRevocationFeed,
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [relative(root, p)];
  });
}

describe("fixtures", () => {
  it("manifest lists every fixture file and nothing else", () => {
    const onDisk = walk(root).filter((p) => p !== "manifest.json").sort();
    expect(manifest.map((e) => e.path).sort()).toEqual(onDisk);
  });

  for (const entry of manifest) {
    it(`${entry.path}${entry.note ? ` (${entry.note})` : ""}`, () => {
      const doc = JSON.parse(readFileSync(join(root, entry.path), "utf8"));
      if (entry.kind === "match") {
        // The list and the normalized request are valid in their own right; then the answer matches.
        const { list, request, now, expect: want } = doc as { list: PublicList; request: unknown; now: string; expect: Record<string, unknown> };
        expect(validateList(list).errors).toEqual([]);
        const req = normalizeVerifyRequest(request);
        expect(validateVerifyRequest(req).errors).toEqual([]);
        const got = matchRequest(list, req as VerifyRequest, Date.parse(now));
        expect({
          status: got.status,
          ...(got.reason ? { reason: got.reason } : {}),
          ...(got.authorization ? { authorization_id: got.authorization.id } : {}),
          ...(got.product ? { product: got.product } : {}),
          signals: got.signals,
        }).toEqual(want);
        return;
      }
      const result = validators[entry.kind](doc, entry);
      if (entry.valid) {
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
      } else {
        expect(result.valid).toBe(false);
        expect(result.errors.map((e) => e.code)).toContain(entry.expect);
      }
    });
  }
});
