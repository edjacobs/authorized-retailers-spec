// Writes src/schemas.ts from schemas/<current version>/*.json, so the built package needs no JSON imports and runs
// the same in Node, Workers, Deno and browsers. Run: node scripts/embed-schemas.mjs
// test/schemas.test.ts fails if src/schemas.ts is out of date.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_VERSION = "0.5";

export function renderSchemasModule() {
  const names = readdirSync(join(root, "schemas", SCHEMA_VERSION)).filter((f) => f.endsWith(".json")).sort();
  const lines = [
    "// Generated from schemas/*.json by scripts/embed-schemas.mjs. Do not edit by hand.",
    "",
  ];
  for (const name of names) {
    const id = name.replace(/\.json$/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const json = JSON.stringify(JSON.parse(readFileSync(join(root, "schemas", SCHEMA_VERSION, name), "utf8")), null, 2);
    lines.push(`export const ${id} = ${json};`, "");
  }
  return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(root, "src", "schemas.ts"), renderSchemasModule());
  console.log("wrote src/schemas.ts");
}
