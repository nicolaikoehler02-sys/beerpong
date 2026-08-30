/**
 * Spielt db/schema.sql gegen die Neon-Datenbank ein.
 * Aufruf: npm run migrate
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

// .env.local einlesen, ohne Zusatzabhaengigkeit
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt. Zuerst 'vercel env pull .env.local' ausfuehren.");
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync("db/schema.sql", "utf8");

// Kommentarzeilen entfernen, dann an Semikolons trennen
const statements = schema
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

console.log("Spiele " + statements.length + " Statements ein...");
for (const stmt of statements) {
  const kopf = stmt.split("\n")[0].slice(0, 68);
  try {
    await sql.query(stmt);
    console.log("  OK   " + kopf);
  } catch (err) {
    console.error("  FAIL " + kopf);
    console.error("       " + (err as Error).message);
    process.exit(1);
  }
}

const tabellen = await sql.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
);
console.log("\nTabellen in der Datenbank: " + tabellen.map((r) => r.table_name).join(", "));
