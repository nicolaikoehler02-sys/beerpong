"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import * as db from "@/lib/db";
import {
  advanceKnockout,
  assignTables,
  computeTable,
  generateKnockout,
  generateRoundRobin,
} from "@/lib/tournament";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return (base || "turnier") + "-" + nanoid(4).toLowerCase();
}

export async function createTournamentAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "Bierpong-Turnier";
  const tableCount = clamp(Number(formData.get("tableCount")), 1, 8, 2);
  const cups = clamp(Number(formData.get("cups")), 3, 21, 10);
  const pin = String(formData.get("pin") ?? "").trim() || null;

  const slug = slugify(name);
  await db.createTournament(nanoid(12), slug, name, tableCount, cups, pin);
  redirect("/t/" + slug + "/setup");
}

export async function addTeamAction(slug: string, formData: FormData) {
  const state = await db.getState(slug);
  if (!state) return;

  const player1 = String(formData.get("player1") ?? "").trim();
  const player2 = String(formData.get("player2") ?? "").trim() || null;
  const name =
    String(formData.get("name") ?? "").trim() ||
    (player2 ? player1 + " & " + player2 : player1);
  if (!player1) return;

  await db.addTeam(
    nanoid(10), state.tournament.id, name, player1, player2, state.teams.length,
  );
  revalidatePath("/t/" + slug + "/setup");
}

export async function removeTeamAction(slug: string, teamId: string) {
  const state = await db.getState(slug);
  if (!state || state.tournament.status !== "setup") return;
  await db.removeTeam(teamId, state.tournament.id);
  revalidatePath("/t/" + slug + "/setup");
}

export async function updateSettingsAction(slug: string, formData: FormData) {
  const state = await db.getState(slug);
  if (!state) return;
  await db.updateSettings(
    state.tournament.id,
    clamp(Number(formData.get("tableCount")), 1, 8, state.tournament.tableCount),
    clamp(Number(formData.get("cups")), 3, 21, state.tournament.cups),
  );
  revalidatePath("/t/" + slug, "layout");
}

/** Lost die Gruppenphase aus und startet das Turnier. */
export async function startTournamentAction(slug: string) {
  const state = await db.getState(slug);
  if (!state || state.teams.length < 3) return;

  // Reihenfolge mischen, damit die Spieltage nicht der Eingabereihenfolge folgen
  const shuffled = [...state.teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const matches = assignTables(
    generateRoundRobin(shuffled),
    state.tournament.tableCount,
  );
  await db.replaceMatches(state.tournament.id, "group", matches);
  await db.setStatus(state.tournament.id, "group");
  revalidatePath("/t/" + slug, "layout");
  redirect("/t/" + slug);
}

export async function saveScoreAction(
  slug: string,
  matchId: string,
  scoreA: number,
  scoreB: number,
  pin: string | null,
) {
  if (!(await db.checkPin(slug, pin))) return { error: "PIN stimmt nicht." };

  const state = await db.getState(slug);
  if (!state) return { error: "Turnier nicht gefunden." };

  await db.saveScore(matchId, scoreA, scoreB, "done");
  await afterResult(slug);
  return { ok: true };
}

/** Macht ein bereits eingetragenes Ergebnis wieder rueckgaengig. */
export async function undoScoreAction(slug: string, matchId: string, pin: string | null) {
  if (!(await db.checkPin(slug, pin))) return { error: "PIN stimmt nicht." };
  await db.saveScore(matchId, null, null, "pending");
  await afterResult(slug);
  return { ok: true };
}

/**
 * Nach jedem Ergebnis: Endrunden-Paarungen nachziehen, freie Tische neu
 * belegen und pruefen, ob eine Phase abgeschlossen ist.
 */
async function afterResult(slug: string) {
  const state = await db.getState(slug);
  if (!state) return;

  const { tournament, teams, matches } = state;
  const group = matches.filter((m) => m.phase === "group");
  const ko = matches.filter((m) => m.phase === "knockout");

  // Halbfinal-Sieger ins Finale und ins Spiel um Platz 3 nachtragen
  if (ko.length > 0) {
    for (const m of advanceKnockout(ko)) {
      const alt = ko.find((x) => x.id === m.id);
      if (alt && (alt.teamA !== m.teamA || alt.teamB !== m.teamB)) {
        await db.saveMatchTeams(m.id, m.teamA, m.teamB);
      }
    }
  }

  // Gruppenphase komplett? Dann Endrunde der besten Vier anlegen.
  const groupDone = group.length > 0 && group.every((m) => m.status === "done");
  if (groupDone && ko.length === 0 && teams.length >= 4) {
    const table = computeTable(teams, group);
    await db.replaceMatches(tournament.id, "knockout", generateKnockout(table));
    await db.setStatus(tournament.id, "knockout");
  }

  // Finale beendet? Turnier abschliessen.
  const finale = ko.find((m) => m.round === 2);
  if (finale?.status === "done") {
    await db.setStatus(tournament.id, "done");
  }

  // Freie Tische mit den naechsten Spielen belegen
  const fresh = await db.getState(slug);
  if (fresh) {
    const before = fresh.matches;
    for (const m of assignTables(before, fresh.tournament.tableCount)) {
      const alt = before.find((x) => x.id === m.id);
      if (alt && alt.status !== m.status) await db.setTable(m.id, m.table);
    }
  }

  revalidatePath("/t/" + slug, "layout");
}

/** Manuelles Setzen eines Spiels auf einen Tisch. */
export async function setTableAction(slug: string, matchId: string, table: number | null) {
  await db.setTable(matchId, table);
  revalidatePath("/t/" + slug, "layout");
}

function clamp(v: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}
