/**
 * Turnierlogik: Round-Robin-Gruppenphase + K.o.-Endrunde der besten Vier.
 *
 * Bewusst frei von DB- und React-Abhaengigkeiten, damit die Paarungs- und
 * Tabellenberechnung isoliert testbar bleibt.
 */

export type Phase = "group" | "knockout";
export type MatchStatus = "pending" | "running" | "done";

export interface Team {
  id: string;
  name: string;
  player1: string;
  player2: string | null;
}

export interface Match {
  id: string;
  phase: Phase;
  /** Gruppenphase: Spieltag 1..n. K.o.: 1 = Halbfinale, 2 = Finale, 3 = Spiel um Platz 3. */
  round: number;
  /** Position innerhalb der Runde, bestimmt die Reihenfolge im Baum. */
  position: number;
  teamA: string | null;
  teamB: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
  /** Tischnummer, sobald das Spiel laeuft. */
  table: number | null;
  label: string;
}

/**
 * Round Robin nach der Kreismethode: Team 0 bleibt fix, alle anderen rotieren.
 * Bei ungerader Teamzahl wird ein Dummy ergaenzt, dessen Partie als Freilos entfaellt.
 */
export function generateRoundRobin(teams: Team[]): Match[] {
  const ids: (string | null)[] = teams.map((t) => t.id);
  if (ids.length % 2 === 1) ids.push(null); // Freilos-Platzhalter

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const matches: Match[] = [];
  let rotating = ids.slice(1);

  for (let r = 0; r < rounds; r++) {
    const lineup = [ids[0], ...rotating];
    let position = 0;

    for (let i = 0; i < half; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];
      if (a === null || b === null) continue; // Freilos: kein Spiel

      // Heim-/Auswaertsseite wechseln, damit nicht immer dieselben anfangen
      const [teamA, teamB] = r % 2 === 0 ? [a, b] : [b, a];

      matches.push({
        id: "g-" + (r + 1) + "-" + (position + 1),
        phase: "group",
        round: r + 1,
        position: position + 1,
        teamA,
        teamB,
        scoreA: null,
        scoreB: null,
        status: "pending",
        table: null,
        label: "Spieltag " + (r + 1),
      });
      position++;
    }

    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return matches;
}

export interface TableRow {
  teamId: string;
  played: number;
  wins: number;
  losses: number;
  cupsFor: number;
  cupsAgainst: number;
  diff: number;
  points: number;
  rank: number;
}

/**
 * Tabelle der Gruppenphase.
 * Wertung: 3 Punkte pro Sieg, dann Becherdifferenz, dann geworfene Becher,
 * zuletzt der direkte Vergleich.
 */
export function computeTable(teams: Team[], matches: Match[]): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const t of teams) {
    rows.set(t.id, {
      teamId: t.id,
      played: 0,
      wins: 0,
      losses: 0,
      cupsFor: 0,
      cupsAgainst: 0,
      diff: 0,
      points: 0,
      rank: 0,
    });
  }

  const finished = matches.filter(
    (m) =>
      m.phase === "group" &&
      m.status === "done" &&
      m.scoreA !== null &&
      m.scoreB !== null &&
      m.teamA !== null &&
      m.teamB !== null,
  );

  for (const m of finished) {
    const a = rows.get(m.teamA!);
    const b = rows.get(m.teamB!);
    if (!a || !b) continue;

    a.played++;
    b.played++;
    a.cupsFor += m.scoreA!;
    a.cupsAgainst += m.scoreB!;
    b.cupsFor += m.scoreB!;
    b.cupsAgainst += m.scoreA!;

    if (m.scoreA! > m.scoreB!) {
      a.wins++;
      a.points += 3;
      b.losses++;
    } else if (m.scoreB! > m.scoreA!) {
      b.wins++;
      b.points += 3;
      a.losses++;
    }
    // Unentschieden gibt es bei Bierpong nicht - gleicher Score bleibt ungewertet.
  }

  for (const row of rows.values()) row.diff = row.cupsFor - row.cupsAgainst;

  const sorted = [...rows.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.diff !== x.diff) return y.diff - x.diff;
    if (y.cupsFor !== x.cupsFor) return y.cupsFor - x.cupsFor;
    return headToHead(x.teamId, y.teamId, finished);
  });

  sorted.forEach((row, i) => (row.rank = i + 1));
  return sorted;
}

/** Direkter Vergleich als letztes Kriterium; 0 wenn nie gegeneinander gespielt. */
function headToHead(x: string, y: string, matches: Match[]): number {
  const duel = matches.find(
    (m) => (m.teamA === x && m.teamB === y) || (m.teamA === y && m.teamB === x),
  );
  if (!duel) return 0;
  const xScore = duel.teamA === x ? duel.scoreA! : duel.scoreB!;
  const yScore = duel.teamA === y ? duel.scoreA! : duel.scoreB!;
  return yScore - xScore;
}

/**
 * K.o.-Runde der besten Vier: 1 gegen 4, 2 gegen 3, danach Finale und Spiel um Platz 3.
 * Wird erst befuellt, wenn alle Gruppenspiele beendet sind.
 */
export function generateKnockout(table: TableRow[]): Match[] {
  const seeded = table.slice(0, 4).map((r) => r.teamId);
  const base = {
    scoreA: null,
    scoreB: null,
    status: "pending" as MatchStatus,
    table: null,
  };

  return [
    {
      ...base,
      id: "k-1-1",
      phase: "knockout" as Phase,
      round: 1,
      position: 1,
      teamA: seeded[0] ?? null,
      teamB: seeded[3] ?? null,
      label: "Halbfinale 1",
    },
    {
      ...base,
      id: "k-1-2",
      phase: "knockout" as Phase,
      round: 1,
      position: 2,
      teamA: seeded[1] ?? null,
      teamB: seeded[2] ?? null,
      label: "Halbfinale 2",
    },
    {
      ...base,
      id: "k-3-1",
      phase: "knockout" as Phase,
      round: 3,
      position: 1,
      teamA: null,
      teamB: null,
      label: "Spiel um Platz 3",
    },
    {
      ...base,
      id: "k-2-1",
      phase: "knockout" as Phase,
      round: 2,
      position: 1,
      teamA: null,
      teamB: null,
      label: "Finale",
    },
  ];
}

export function winnerOf(m: Match): string | null {
  if (m.status !== "done" || m.scoreA === null || m.scoreB === null) return null;
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? m.teamA : m.teamB;
}

export function loserOf(m: Match): string | null {
  const w = winnerOf(m);
  if (!w) return null;
  return w === m.teamA ? m.teamB : m.teamA;
}

/**
 * Traegt Sieger und Verlierer der Halbfinals in Finale und Spiel um Platz 3 ein.
 * Gibt eine neue Liste zurueck, mutiert nichts.
 */
export function advanceKnockout(matches: Match[]): Match[] {
  const semis = matches
    .filter((m) => m.phase === "knockout" && m.round === 1)
    .sort((a, b) => a.position - b.position);
  if (semis.length < 2) return matches;

  const [s1, s2] = semis;

  return matches.map((m) => {
    if (m.phase !== "knockout") return m;
    if (m.round === 2) {
      return { ...m, teamA: winnerOf(s1), teamB: winnerOf(s2) };
    }
    if (m.round === 3) {
      return { ...m, teamA: loserOf(s1), teamB: loserOf(s2) };
    }
    return m;
  });
}

/**
 * Verteilt anstehende Spiele auf freie Tische. Ein Team kann nie an zwei
 * Tischen gleichzeitig stehen.
 */
export function assignTables(matches: Match[], tableCount: number): Match[] {
  const running = matches.filter((m) => m.status === "running");
  const busyTables = new Set(running.map((m) => m.table));
  const busyTeams = new Set(running.flatMap((m) => [m.teamA, m.teamB]));

  const free: number[] = [];
  for (let i = 1; i <= tableCount; i++) {
    if (!busyTables.has(i)) free.push(i);
  }
  if (free.length === 0) return matches;

  const queue = matches
    .filter((m) => m.status === "pending" && m.teamA && m.teamB)
    .sort((a, b) =>
      a.phase !== b.phase
        ? a.phase === "group"
          ? -1
          : 1
        : a.round - b.round || a.position - b.position,
    );

  const assigned = new Map<string, number>();
  for (const m of queue) {
    if (free.length === 0) break;
    if (busyTeams.has(m.teamA) || busyTeams.has(m.teamB)) continue;
    assigned.set(m.id, free.shift()!);
    busyTeams.add(m.teamA);
    busyTeams.add(m.teamB);
  }

  return matches.map((m) =>
    assigned.has(m.id)
      ? { ...m, status: "running" as MatchStatus, table: assigned.get(m.id)! }
      : m,
  );
}

/* ---------- Auswertungen fuer die Anzeige ---------- */

export interface Fortschritt {
  gespielt: number;
  gesamt: number;
  offen: number;
  /** Geschaetzte Restdauer in Minuten, null solange zu wenig Daten vorliegen. */
  restMinuten: number | null;
  /** Durchschnitt pro Spiel in Minuten, ueber alle Tische hinweg gerechnet. */
  schnittMinuten: number | null;
}

/**
 * Fortschritt und Restzeitschaetzung.
 *
 * Die Schaetzung kalibriert sich selbst: sie misst die real vergangene Zeit
 * zwischen dem ersten und dem letzten beendeten Spiel und teilt sie durch
 * deren Anzahl. Damit ist die Parallelitaet mehrerer Tische bereits
 * eingerechnet, ohne sie modellieren zu muessen.
 */
export function computeFortschritt(
  matches: Array<Match & { updatedAt?: string | Date | null }>,
): Fortschritt {
  const gesamt = matches.length;
  const fertig = matches.filter((m) => m.status === "done");
  const gespielt = fertig.length;
  const offen = gesamt - gespielt;

  const zeiten = fertig
    .map((m) => (m.updatedAt ? new Date(m.updatedAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  // Erst ab drei beendeten Spielen ist der Schnitt einigermassen belastbar.
  if (zeiten.length < 3 || offen === 0) {
    return { gespielt, gesamt, offen, restMinuten: null, schnittMinuten: null };
  }

  const spanneMin = (zeiten[zeiten.length - 1] - zeiten[0]) / 60000;
  const schnitt = spanneMin / (zeiten.length - 1);
  if (!Number.isFinite(schnitt) || schnitt <= 0) {
    return { gespielt, gesamt, offen, restMinuten: null, schnittMinuten: null };
  }

  return {
    gespielt,
    gesamt,
    offen,
    restMinuten: Math.round(schnitt * offen),
    schnittMinuten: Math.round(schnitt * 10) / 10,
  };
}

export interface Rekord {
  titel: string;
  wert: string;
  detail: string;
}

/** Rekorde des Abends, rein aus den vorhandenen Ergebnissen abgeleitet. */
export function computeRekorde(teams: Team[], matches: Match[]): Rekord[] {
  const namen = new Map(teams.map((t) => [t.id, t.name]));
  const fertig = matches.filter(
    (m) => m.status === "done" && m.scoreA !== null && m.scoreB !== null,
  );
  if (fertig.length === 0) return [];

  const rekorde: Rekord[] = [];

  // Hoechster Sieg: groesste Becherdifferenz
  const deutlich = [...fertig].sort(
    (a, b) =>
      Math.abs(b.scoreA! - b.scoreB!) - Math.abs(a.scoreA! - a.scoreB!),
  )[0];
  const dSieger = deutlich.scoreA! > deutlich.scoreB! ? deutlich.teamA : deutlich.teamB;
  const dVerlierer = dSieger === deutlich.teamA ? deutlich.teamB : deutlich.teamA;
  rekorde.push({
    titel: "Deutlichster Sieg",
    wert: Math.max(deutlich.scoreA!, deutlich.scoreB!) + ":" + Math.min(deutlich.scoreA!, deutlich.scoreB!),
    detail: (namen.get(dSieger ?? "") ?? "?") + " gegen " + (namen.get(dVerlierer ?? "") ?? "?"),
  });

  // Knappstes Spiel: kleinste Differenz
  const knapp = [...fertig].sort(
    (a, b) =>
      Math.abs(a.scoreA! - a.scoreB!) - Math.abs(b.scoreA! - b.scoreB!),
  )[0];
  const kSieger = knapp.scoreA! > knapp.scoreB! ? knapp.teamA : knapp.teamB;
  const kVerlierer = kSieger === knapp.teamA ? knapp.teamB : knapp.teamA;
  rekorde.push({
    titel: "Knappstes Spiel",
    wert: Math.max(knapp.scoreA!, knapp.scoreB!) + ":" + Math.min(knapp.scoreA!, knapp.scoreB!),
    detail: (namen.get(kSieger ?? "") ?? "?") + " gegen " + (namen.get(kVerlierer ?? "") ?? "?"),
  });

  // Meiste getroffene Becher ueber alle Spiele
  const becher = new Map<string, number>();
  for (const m of fertig) {
    if (m.teamA) becher.set(m.teamA, (becher.get(m.teamA) ?? 0) + m.scoreA!);
    if (m.teamB) becher.set(m.teamB, (becher.get(m.teamB) ?? 0) + m.scoreB!);
  }
  const beste = [...becher.entries()].sort((a, b) => b[1] - a[1])[0];
  if (beste) {
    rekorde.push({
      titel: "Meiste Becher",
      wert: String(beste[1]),
      detail: namen.get(beste[0]) ?? "?",
    });
  }

  // Laengste Siegesserie in chronologischer Reihenfolge der Spiele
  const serien = new Map<string, number>();
  const laufend = new Map<string, number>();
  for (const m of fertig) {
    const sieger = m.scoreA! > m.scoreB! ? m.teamA : m.teamB;
    const verlierer = sieger === m.teamA ? m.teamB : m.teamA;
    if (sieger) {
      const neu = (laufend.get(sieger) ?? 0) + 1;
      laufend.set(sieger, neu);
      serien.set(sieger, Math.max(serien.get(sieger) ?? 0, neu));
    }
    if (verlierer) laufend.set(verlierer, 0);
  }
  const serie = [...serien.entries()].sort((a, b) => b[1] - a[1])[0];
  if (serie && serie[1] > 1) {
    rekorde.push({
      titel: "Längste Siegesserie",
      wert: serie[1] + " Siege",
      detail: namen.get(serie[0]) ?? "?",
    });
  }

  return rekorde;
}

/** Welche Tische sind frei und welche Teams stehen gerade schon an einem. */
export function tischLage(
  matches: Match[],
  tableCount: number,
): { freieTische: number[]; blockierteTeams: string[] } {
  const laufend = matches.filter((m) => m.status === "running");
  const belegt = new Set(laufend.map((m) => m.table));

  const freieTische: number[] = [];
  for (let i = 1; i <= tableCount; i++) if (!belegt.has(i)) freieTische.push(i);

  const blockierteTeams = laufend
    .flatMap((m) => [m.teamA, m.teamB])
    .filter((x): x is string => x !== null);

  return { freieTische, blockierteTeams };
}
