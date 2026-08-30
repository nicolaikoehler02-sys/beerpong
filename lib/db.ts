import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Match, MatchStatus, Phase, Team } from "./tournament";

const sql = neon(process.env.DATABASE_URL!);

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  status: "setup" | "group" | "knockout" | "done";
  tableCount: number;
  cups: number;
  hasPin: boolean;
}

export interface TournamentState {
  tournament: Tournament;
  teams: Team[];
  matches: Match[];
}

/* ---------- Lesen ---------- */

export async function listTournaments(): Promise<Tournament[]> {
  const rows = await sql`
    SELECT id, slug, name, status, table_count, cups, admin_pin
    FROM tournaments ORDER BY created_at DESC LIMIT 20`;
  return rows.map(toTournament);
}

export async function getState(slug: string): Promise<TournamentState | null> {
  const [t] = await sql`
    SELECT id, slug, name, status, table_count, cups, admin_pin
    FROM tournaments WHERE slug = ${slug}`;
  if (!t) return null;

  const [teamRows, matchRows] = await Promise.all([
    sql`SELECT id, name, player1, player2 FROM teams
        WHERE tournament_id = ${t.id} ORDER BY seed, created_at`,
    sql`SELECT id, phase, round, position, label, team_a, team_b,
               score_a, score_b, status, table_no
        FROM matches WHERE tournament_id = ${t.id}
        ORDER BY phase DESC, round, position`,
  ]);

  return {
    tournament: toTournament(t),
    teams: teamRows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      player1: r.player1 as string,
      player2: r.player2 as string | null,
    })),
    matches: matchRows.map(toMatch),
  };
}

/** Nur der Zeitstempel der letzten Aenderung - fuer guenstiges Polling. */
export async function getVersion(slug: string): Promise<string> {
  const [row] = await sql`
    SELECT COALESCE(MAX(m.updated_at), t.created_at) AS v
    FROM tournaments t LEFT JOIN matches m ON m.tournament_id = t.id
    WHERE t.slug = ${slug} GROUP BY t.created_at`;
  return row ? String(row.v) : "";
}

export async function checkPin(slug: string, pin: string | null): Promise<boolean> {
  const [row] = await sql`SELECT admin_pin FROM tournaments WHERE slug = ${slug}`;
  if (!row || !row.admin_pin) return true; // kein PIN gesetzt: offen fuer alle
  return row.admin_pin === pin;
}

/* ---------- Schreiben ---------- */

export async function createTournament(
  id: string,
  slug: string,
  name: string,
  tableCount: number,
  cups: number,
  pin: string | null,
): Promise<void> {
  await sql`
    INSERT INTO tournaments (id, slug, name, table_count, cups, admin_pin)
    VALUES (${id}, ${slug}, ${name}, ${tableCount}, ${cups}, ${pin})`;
}

export async function addTeam(
  id: string,
  tournamentId: string,
  name: string,
  player1: string,
  player2: string | null,
  seed: number,
): Promise<void> {
  await sql`
    INSERT INTO teams (id, tournament_id, name, player1, player2, seed)
    VALUES (${id}, ${tournamentId}, ${name}, ${player1}, ${player2}, ${seed})`;
}

export async function removeTeam(teamId: string, tournamentId: string): Promise<void> {
  await sql`DELETE FROM teams WHERE id = ${teamId} AND tournament_id = ${tournamentId}`;
}

export async function updateSettings(
  tournamentId: string,
  tableCount: number,
  cups: number,
): Promise<void> {
  await sql`
    UPDATE tournaments SET table_count = ${tableCount}, cups = ${cups}
    WHERE id = ${tournamentId}`;
}

export async function setStatus(
  tournamentId: string,
  status: Tournament["status"],
): Promise<void> {
  await sql`UPDATE tournaments SET status = ${status} WHERE id = ${tournamentId}`;
}

/** Ersetzt alle Spiele einer Phase - genutzt beim Auslosen und beim Start der Endrunde. */
export async function replaceMatches(
  tournamentId: string,
  phase: Phase,
  matches: Match[],
): Promise<void> {
  await sql`DELETE FROM matches WHERE tournament_id = ${tournamentId} AND phase = ${phase}`;
  for (const m of matches) {
    await sql`
      INSERT INTO matches (id, tournament_id, phase, round, position, label,
                           team_a, team_b, score_a, score_b, status, table_no)
      VALUES (${tournamentId + ":" + m.id}, ${tournamentId}, ${m.phase}, ${m.round},
              ${m.position}, ${m.label}, ${m.teamA}, ${m.teamB},
              ${m.scoreA}, ${m.scoreB}, ${m.status}, ${m.table})`;
  }
}

export async function saveScore(
  matchId: string,
  scoreA: number | null,
  scoreB: number | null,
  status: MatchStatus,
): Promise<void> {
  await sql`
    UPDATE matches
    SET score_a = ${scoreA}, score_b = ${scoreB}, status = ${status},
        table_no = CASE WHEN ${status} = 'done' THEN NULL ELSE table_no END,
        updated_at = now()
    WHERE id = ${matchId}`;
}

export async function saveMatchTeams(
  matchId: string,
  teamA: string | null,
  teamB: string | null,
): Promise<void> {
  await sql`
    UPDATE matches SET team_a = ${teamA}, team_b = ${teamB}, updated_at = now()
    WHERE id = ${matchId}`;
}

export async function setTable(matchId: string, table: number | null): Promise<void> {
  await sql`
    UPDATE matches
    SET table_no = ${table}, status = ${table === null ? "pending" : "running"},
        updated_at = now()
    WHERE id = ${matchId}`;
}

/* ---------- Mapping ---------- */

type Row = Record<string, unknown>;

function toTournament(r: Row): Tournament {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    status: r.status as Tournament["status"],
    tableCount: r.table_count as number,
    cups: r.cups as number,
    hasPin: Boolean(r.admin_pin),
  };
}

function toMatch(r: Row): Match {
  return {
    id: r.id as string,
    phase: r.phase as Phase,
    round: r.round as number,
    position: r.position as number,
    label: r.label as string,
    teamA: r.team_a as string | null,
    teamB: r.team_b as string | null,
    scoreA: r.score_a as number | null,
    scoreB: r.score_b as number | null,
    status: r.status as MatchStatus,
    table: r.table_no as number | null,
  };
}

/** Loescht ein Turnier samt Teams und Spielen (per ON DELETE CASCADE). */
export async function deleteTournament(id: string): Promise<void> {
  await sql`DELETE FROM tournaments WHERE id = ${id}`;
}
