/**
 * Ende-zu-Ende-Test gegen die laufende Seite.
 * Legt ein Testturnier direkt in der Datenbank an, spielt die Gruppenphase
 * durch, erzeugt die Endrunde und prueft, dass alle Seiten sauber rendern.
 *
 * Aufruf: npm run smoke -- https://deine-url.vercel.app
 * Raeumt am Ende hinter sich auf.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import {
  advanceKnockout,
  assignTables,
  computeTable,
  generateKnockout,
  generateRoundRobin,
  type Team,
} from "../lib/tournament.ts";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const basis = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const sql = neon(process.env.DATABASE_URL!);

let ok = true;
function check(label: string, cond: boolean, extra = "") {
  if (!cond) ok = false;
  console.log((cond ? "  OK   " : "  FAIL ") + label + (extra ? "  -> " + extra : ""));
}

const tid = "smoke-" + Date.now();
const slug = "smoke-test-" + Date.now();

const teams: Team[] = [
  { id: tid + "-a", name: "Dünendrifter", player1: "Nico", player2: "Lars" },
  { id: tid + "-b", name: "Kniepsand Kings", player1: "Ben", player2: "Jan" },
  { id: tid + "-c", name: "Strandhafer", player1: "Mia", player2: "Tom" },
  { id: tid + "-d", name: "Wattwürmer", player1: "Ida", player2: "Ole" },
  { id: tid + "-e", name: "Nordseewellen", player1: "Finn", player2: "Ann" },
  { id: tid + "-f", name: "Campingplatz FC", player1: "Kai", player2: "Sam" },
];

async function seite(pfad: string): Promise<{ code: number; text: string }> {
  const res = await fetch(basis + pfad, { headers: { "cache-control": "no-cache" } });
  return { code: res.status, text: await res.text() };
}

console.log("\nTeste gegen: " + basis + "\n");

try {
  /* --- Turnier anlegen --- */
  await sql`INSERT INTO tournaments (id, slug, name, table_count, cups)
            VALUES (${tid}, ${slug}, ${"Smoke-Test Turnier"}, 3, 10)`;
  for (const [i, t] of teams.entries()) {
    await sql`INSERT INTO teams (id, tournament_id, name, player1, player2, seed)
              VALUES (${t.id}, ${tid}, ${t.name}, ${t.player1}, ${t.player2}, ${i})`;
  }

  console.log("=== Gruppenphase anlegen ===");
  const gruppe = assignTables(generateRoundRobin(teams), 3);
  for (const m of gruppe) {
    await sql`INSERT INTO matches (id, tournament_id, phase, round, position, label,
                                   team_a, team_b, status, table_no)
              VALUES (${tid + ":" + m.id}, ${tid}, ${m.phase}, ${m.round}, ${m.position},
                      ${m.label}, ${m.teamA}, ${m.teamB}, ${m.status}, ${m.table})`;
  }
  await sql`UPDATE tournaments SET status = 'group' WHERE id = ${tid}`;
  check("15 Spiele in der Datenbank",
    (await sql`SELECT count(*)::int AS n FROM matches WHERE tournament_id = ${tid}`)[0].n === 15);
  check("3 Spiele auf Tischen",
    (await sql`SELECT count(*)::int AS n FROM matches
               WHERE tournament_id = ${tid} AND status = 'running'`)[0].n === 3);

  let r = await seite("/t/" + slug);
  check("Live-Seite laedt", r.code === 200, "HTTP " + r.code);
  check("Live-Seite zeigt Teamnamen", r.text.includes("Dünendrifter"));
  check("Live-Seite zeigt Tischnummer", r.text.includes("Tisch"));

  r = await seite("/t/" + slug + "/tv");
  check("TV-Seite laedt", r.code === 200, "HTTP " + r.code);
  check("TV-Seite zeigt Tabelle", r.text.includes("Pkt"));

  r = await seite("/t/" + slug + "/qr");
  check("QR-Seite laedt", r.code === 200, "HTTP " + r.code);
  check("QR-Seite enthaelt ein SVG", r.text.includes("<svg"));

  r = await seite("/t/" + slug + "/setup");
  check("Setup-Seite laedt", r.code === 200, "HTTP " + r.code);
  check("Setup sperrt Teams nach Start", r.text.includes("läuft bereits"));

  /* --- Alle Gruppenspiele auswerten --- */
  console.log("\n=== Gruppenphase durchspielen ===");
  for (const m of gruppe) {
    const aStaerker = m.teamA! < m.teamB!;
    await sql`UPDATE matches SET score_a = ${aStaerker ? 10 : 6},
                                 score_b = ${aStaerker ? 6 : 10},
                                 status = 'done', table_no = NULL, updated_at = now()
              WHERE id = ${tid + ":" + m.id}`;
  }

  const rows = await sql`SELECT id, phase, round, position, label, team_a, team_b,
                                score_a, score_b, status, table_no
                         FROM matches WHERE tournament_id = ${tid}`;
  const gespielt = rows.map((x) => ({
    id: x.id as string, phase: x.phase as "group", round: x.round as number,
    position: x.position as number, label: x.label as string,
    teamA: x.team_a as string | null, teamB: x.team_b as string | null,
    scoreA: x.score_a as number | null, scoreB: x.score_b as number | null,
    status: x.status as "done", table: x.table_no as number | null,
  }));

  const tabelle = computeTable(teams, gespielt);
  check("alle 6 Teams haben 5 Spiele", tabelle.every((t) => t.played === 5));
  check("Punktsumme stimmt (15 Siege x 3)",
    tabelle.reduce((s, t) => s + t.points, 0) === 45,
    "ist: " + tabelle.reduce((s, t) => s + t.points, 0));

  /* --- Endrunde --- */
  console.log("\n=== Endrunde ===");
  const ko = generateKnockout(tabelle);
  for (const m of ko) {
    await sql`INSERT INTO matches (id, tournament_id, phase, round, position, label,
                                   team_a, team_b, status)
              VALUES (${tid + ":" + m.id}, ${tid}, ${m.phase}, ${m.round}, ${m.position},
                      ${m.label}, ${m.teamA}, ${m.teamB}, 'pending')`;
  }
  await sql`UPDATE tournaments SET status = 'knockout' WHERE id = ${tid}`;

  r = await seite("/t/" + slug);
  check("Endrunde erscheint auf der Live-Seite", r.text.includes("Halbfinale"));

  // Halbfinals auswerten, Sieger nachziehen
  const semis = ko.filter((m) => m.round === 1);
  for (const m of semis) {
    await sql`UPDATE matches SET score_a = 10, score_b = 7, status = 'done', updated_at = now()
              WHERE id = ${tid + ":" + m.id}`;
  }
  const nachSemis = ko.map((m) =>
    m.round === 1 ? { ...m, status: "done" as const, scoreA: 10, scoreB: 7 } : m,
  );
  for (const m of advanceKnockout(nachSemis)) {
    if (m.round === 2 || m.round === 3) {
      await sql`UPDATE matches SET team_a = ${m.teamA}, team_b = ${m.teamB}, updated_at = now()
                WHERE id = ${tid + ":" + m.id}`;
    }
  }
  const [fin] = await sql`SELECT team_a, team_b FROM matches
                          WHERE tournament_id = ${tid} AND round = 2 AND phase = 'knockout'`;
  check("Finale ist besetzt", Boolean(fin.team_a && fin.team_b),
    String(fin.team_a) + " vs " + String(fin.team_b));
  check("Finalisten sind die Halbfinalsieger",
    fin.team_a === tabelle[0].teamId && fin.team_b === tabelle[1].teamId);

  // Finale entscheiden
  await sql`UPDATE matches SET score_a = 10, score_b = 4, status = 'done', updated_at = now()
            WHERE tournament_id = ${tid} AND round = 2 AND phase = 'knockout'`;
  await sql`UPDATE tournaments SET status = 'done' WHERE id = ${tid}`;

  r = await seite("/t/" + slug);
  check("Siegerbanner erscheint", r.text.includes("Turniersieger"), "HTTP " + r.code);
  const siegerName = teams.find((t) => t.id === tabelle[0].teamId)!.name;
  check("richtiger Sieger genannt", r.text.includes(siegerName), siegerName);

  r = await seite("/t/" + slug + "/tv");
  check("TV zeigt den Sieger gross", r.text.includes("Turniersieger"));

  /* --- Fehlerfaelle --- */
  console.log("\n=== Fehlerfaelle ===");
  r = await seite("/t/gibtsnicht-xyz");
  check("unbekanntes Turnier gibt 404", r.code === 404, "HTTP " + r.code);
  r = await seite("/");
  check("Startseite laedt", r.code === 200, "HTTP " + r.code);
} finally {
  await sql`DELETE FROM tournaments WHERE id = ${tid}`;
  const [rest] = await sql`SELECT count(*)::int AS n FROM matches WHERE tournament_id = ${tid}`;
  console.log("\nAufgeraeumt. Restliche Testspiele: " + rest.n);
}

console.log(ok ? "\nSmoke-Test bestanden.\n" : "\nSMOKE-TEST FEHLGESCHLAGEN.\n");
process.exit(ok ? 0 : 1);
