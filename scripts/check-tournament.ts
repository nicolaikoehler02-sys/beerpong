import {
  generateRoundRobin,
  computeTable,
  generateKnockout,
  advanceKnockout,
  assignTables,
  computeFortschritt,
  computeRekorde,
  tischLage,
  type Team,
  type Match,
} from "../lib/tournament.ts";

const teams: Team[] = [
  { id: "t1", name: "Dünendrifter", player1: "Nico", player2: "Lars" },
  { id: "t2", name: "Kniepsand Kings", player1: "Ben", player2: "Jan" },
  { id: "t3", name: "Strandhafer", player1: "Mia", player2: "Tom" },
  { id: "t4", name: "Wattwürmer", player1: "Ida", player2: "Ole" },
  { id: "t5", name: "Nordseewellen", player1: "Finn", player2: "Ann" },
  { id: "t6", name: "Campingplatz FC", player1: "Kai", player2: "Sam" },
];

let ok = true;
function check(label: string, cond: boolean, extra = "") {
  if (!cond) ok = false;
  console.log((cond ? "  OK   " : "  FAIL ") + label + (extra ? "  -> " + extra : ""));
}

console.log("\n=== Round Robin, 6 Teams ===");
const rr = generateRoundRobin(teams);
check("15 Spiele insgesamt", rr.length === 15, "ist: " + rr.length);
check("5 Spieltage", new Set(rr.map((m) => m.round)).size === 5);

const perTeam = new Map<string, number>();
for (const m of rr) {
  perTeam.set(m.teamA!, (perTeam.get(m.teamA!) ?? 0) + 1);
  perTeam.set(m.teamB!, (perTeam.get(m.teamB!) ?? 0) + 1);
}
check("jedes Team genau 5 Spiele", [...perTeam.values()].every((v) => v === 5),
  [...perTeam.entries()].map(([k, v]) => k + ":" + v).join(" "));

const pairs = new Set(rr.map((m) => [m.teamA, m.teamB].sort().join("-")));
check("jede Paarung genau einmal", pairs.size === 15, "ist: " + pairs.size);

for (let r = 1; r <= 5; r++) {
  const day = rr.filter((m) => m.round === r);
  const involved = day.flatMap((m) => [m.teamA, m.teamB]);
  check("Spieltag " + r + ": kein Team doppelt",
    new Set(involved).size === involved.length);
}

console.log("\n=== Ungerade Teamzahl (5 Teams) ===");
const rr5 = generateRoundRobin(teams.slice(0, 5));
check("10 Spiele bei 5 Teams", rr5.length === 10, "ist: " + rr5.length);
const per5 = new Map<string, number>();
for (const m of rr5) {
  per5.set(m.teamA!, (per5.get(m.teamA!) ?? 0) + 1);
  per5.set(m.teamB!, (per5.get(m.teamB!) ?? 0) + 1);
}
check("jedes Team 4 Spiele", [...per5.values()].every((v) => v === 4),
  [...per5.entries()].map(([k, v]) => k + ":" + v).join(" "));

console.log("\n=== Tabelle ===");
// Alle Spiele auswerten: niedrigerer Team-Index gewinnt, damit die Rangfolge vorhersagbar ist.
const played: Match[] = rr.map((m) => {
  const aRank = Number(m.teamA!.slice(1));
  const bRank = Number(m.teamB!.slice(1));
  const aWins = aRank < bRank;
  return {
    ...m,
    status: "done" as const,
    scoreA: aWins ? 10 : 10 - aRank,
    scoreB: aWins ? 10 - bRank : 10,
  };
});
const table = computeTable(teams, played);
console.log("  " + table.map((r) => r.rank + "." + r.teamId + "(" + r.points + "P," + r.diff + ")").join("  "));
check("Tabellenfuehrer ist t1", table[0].teamId === "t1");
check("Letzter ist t6", table[5].teamId === "t6");
check("t1 hat 15 Punkte", table[0].points === 15, "ist: " + table[0].points);
check("jedes Team 5 Spiele gewertet", table.every((r) => r.played === 5));

console.log("\n=== K.o. der Top 4 ===");
let ko = generateKnockout(table);
check("Halbfinale 1 = 1 gegen 4", ko[0].teamA === "t1" && ko[0].teamB === "t4",
  ko[0].teamA + " vs " + ko[0].teamB);
check("Halbfinale 2 = 2 gegen 3", ko[1].teamA === "t2" && ko[1].teamB === "t3",
  ko[1].teamA + " vs " + ko[1].teamB);

ko = ko.map((m) =>
  m.round === 1 ? { ...m, status: "done" as const, scoreA: 10, scoreB: 6 } : m,
);
ko = advanceKnockout(ko);
const finale = ko.find((m) => m.round === 2)!;
const platz3 = ko.find((m) => m.round === 3)!;
check("Finale: t1 gegen t2", finale.teamA === "t1" && finale.teamB === "t2",
  finale.teamA + " vs " + finale.teamB);
check("Platz 3: t4 gegen t3", platz3.teamA === "t4" && platz3.teamB === "t3",
  platz3.teamA + " vs " + platz3.teamB);

console.log("\n=== Tischverteilung (3 Tische) ===");
const assigned = assignTables(rr, 3);
const running = assigned.filter((m) => m.status === "running");
check("3 Spiele gestartet", running.length === 3, "ist: " + running.length);
const runTeams = running.flatMap((m) => [m.teamA, m.teamB]);
check("kein Team an zwei Tischen", new Set(runTeams).size === runTeams.length);
check("Tische 1,2,3 vergeben",
  JSON.stringify(running.map((m) => m.table).sort()) === "[1,2,3]",
  running.map((m) => m.table).join(","));

// Bei 6 Teams koennen hoechstens 3 Spiele parallel laufen.
const assigned9 = assignTables(rr, 9);
check("nie mehr Spiele als Teams erlauben",
  assigned9.filter((m) => m.status === "running").length === 3,
  "ist: " + assigned9.filter((m) => m.status === "running").length);

console.log("\n=== Rekorde ===");
const rekMatches: Match[] = [
  { ...rr[0], teamA: "t1", teamB: "t2", status: "done", scoreA: 10, scoreB: 0 },
  { ...rr[1], teamA: "t3", teamB: "t4", status: "done", scoreA: 9, scoreB: 10 },
  { ...rr[2], teamA: "t1", teamB: "t5", status: "done", scoreA: 10, scoreB: 7 },
  { ...rr[3], teamA: "t1", teamB: "t6", status: "done", scoreA: 10, scoreB: 3 },
];
const rek = computeRekorde(teams, rekMatches);
const finde = (t: string) => rek.find((r) => r.titel === t);
check("deutlichster Sieg ist 10:0", finde("Deutlichster Sieg")?.wert === "10:0",
  String(finde("Deutlichster Sieg")?.wert));
check("knappstes Spiel ist 10:9", finde("Knappstes Spiel")?.wert === "10:9",
  String(finde("Knappstes Spiel")?.wert));
check("meiste Becher: t1 mit 30", finde("Meiste Becher")?.wert === "30",
  String(finde("Meiste Becher")?.wert) + " von " + String(finde("Meiste Becher")?.detail));
check("laengste Serie: 3 Siege", finde("Längste Siegesserie")?.wert === "3 Siege",
  String(finde("Längste Siegesserie")?.wert));
check("ohne Ergebnisse keine Rekorde", computeRekorde(teams, rr).length === 0);

console.log("\n=== Fortschritt und Restzeit ===");
const t0 = Date.now();
const mitZeit = rr.map((m, i) => ({
  ...m,
  status: (i < 5 ? "done" : "pending") as Match["status"],
  scoreA: i < 5 ? 10 : null,
  scoreB: i < 5 ? 5 : null,
  // fuenf beendete Spiele im Abstand von je 10 Minuten
  updatedAt: i < 5 ? new Date(t0 + i * 10 * 60000).toISOString() : null,
}));
const f = computeFortschritt(mitZeit);
check("5 von 15 gespielt", f.gespielt === 5 && f.gesamt === 15, f.gespielt + "/" + f.gesamt);
check("10 Spiele offen", f.offen === 10, String(f.offen));
check("Schnitt 10 Min pro Spiel", f.schnittMinuten === 10, String(f.schnittMinuten));
check("Restzeit 100 Min", f.restMinuten === 100, String(f.restMinuten));
const leer = computeFortschritt(rr.map((m) => ({ ...m, updatedAt: null })));
check("ohne Daten keine Schaetzung", leer.restMinuten === null);

console.log("\n=== Tischlage ===");
const lage = tischLage(assigned, 3);
check("keine freien Tische bei 3 laufenden", lage.freieTische.length === 0,
  lage.freieTische.join(","));
check("6 Teams gebunden", lage.blockierteTeams.length === 6,
  String(lage.blockierteTeams.length));
const lage5 = tischLage(assigned, 5);
check("bei 5 Tischen sind 4 und 5 frei",
  JSON.stringify(lage5.freieTische) === "[4,5]", lage5.freieTische.join(","));

console.log(ok ? "\nAlle Checks bestanden.\n" : "\nES GIBT FEHLER.\n");
process.exit(ok ? 0 : 1);
