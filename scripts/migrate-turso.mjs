import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@libsql/client/web";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("Missing TURSO_DATABASE_URL.");

const db = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const migrationsDir = resolve("turso/migrations");
const migrationFiles = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of migrationFiles) {
  const migration = await readFile(resolve(migrationsDir, file), "utf8");
  await db.executeMultiple(migration);
  console.log(`Applied ${file}`);
}
console.log("Turso migrations applied.");
db.close();
