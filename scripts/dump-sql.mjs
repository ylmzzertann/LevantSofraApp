// Writes the schema to supabase/schema.sql so it can be pasted into the
// Supabase SQL editor.  npm run db:sql

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/db/ddl.ts"), "utf8");

const match = source.match(/export const SCHEMA_SQL = `([\s\S]*?)`;/);
if (!match) {
  console.error("Couldn't find SCHEMA_SQL in src/db/ddl.ts");
  process.exit(1);
}

const out = resolve(root, "supabase/schema.sql");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `-- Generated from src/db/ddl.ts by \`npm run db:sql\`. Do not edit by hand.\n${match[1]}`,
);
console.log(`wrote ${out}`);
