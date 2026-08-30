"use client";

import { useState, useTransition } from "react";
import { saveScoreAction, undoScoreAction } from "@/app/actions";
import type { Match, Team } from "@/lib/tournament";

/**
 * Ergebniseingabe in zwei Schritten, auf Bedienung mit einer Hand am Handy
 * ausgelegt: erst den Sieger antippen, dann dessen uebrig gebliebene Becher.
 *
 * Gefragt wird nach den Bechern, die beim Sieger noch stehen (1 bis cups) -
 * genau das sieht man am Tischende vor sich. Gespeichert wird daraus der
 * uebliche Score: der Sieger hat alle gegnerischen Becher getroffen, der
 * Verlierer entsprechend cups minus uebrige.
 */
export function ScoreEntry({
  slug,
  match,
  teams,
  cups,
}: {
  slug: string;
  match: Match;
  teams: Team[];
  cups: number;
}) {
  const [sieger, setSieger] = useState<"a" | "b" | null>(null);
  const [pending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const teamA = teams.find((t) => t.id === match.teamA);
  const teamB = teams.find((t) => t.id === match.teamB);
  if (!teamA || !teamB) return null;

  const pin = () =>
    typeof window === "undefined" ? null : localStorage.getItem("bierpong-pin");

  /** uebrig = Becher, die beim Sieger noch stehen (1 bis cups). */
  const speichern = (uebrig: number) => {
    const verliererScore = cups - uebrig;
    const [a, b] =
      sieger === "a" ? [cups, verliererScore] : [verliererScore, cups];
    startTransition(async () => {
      const res = await saveScoreAction(slug, match.id, a, b, pin());
      if (res?.error) setFehler(res.error);
      else setSieger(null);
    });
  };

  const zuruecksetzen = () => {
    startTransition(async () => {
      const res = await undoScoreAction(slug, match.id, pin());
      if (res?.error) setFehler(res.error);
    });
  };

  /* Fertiges Spiel: Ergebnis anzeigen, Korrektur anbieten */
  if (match.status === "done" && match.scoreA !== null && match.scoreB !== null) {
    const aGewinnt = match.scoreA > match.scoreB;
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={"truncate " + (aGewinnt ? "text-duene-hell font-semibold" : "text-sand/60")}>
            {teamA.name}
          </div>
          <div className={"truncate " + (!aGewinnt ? "text-duene-hell font-semibold" : "text-sand/60")}>
            {teamB.name}
          </div>
        </div>
        <div className="tabular text-2xl font-bold shrink-0">
          {match.scoreA}:{match.scoreB}
        </div>
        <button
          onClick={zuruecksetzen}
          disabled={pending}
          className="shrink-0 rounded-lg border border-kante px-2 py-1 text-xs text-sand/60
                     hover:text-sand hover:border-sand/50 disabled:opacity-40"
          title="Ergebnis korrigieren"
        >
          {pending ? "..." : "korrigieren"}
        </button>
      </div>
    );
  }

  /* Schritt 2: uebrige Becher des Siegers */
  if (sieger) {
    const gewinner = sieger === "a" ? teamA : teamB;
    return (
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-sand/70">
            Wie viele Becher hatte <b className="text-sand-hell">{gewinner.name}</b> noch
            übrig?
          </span>
          <button onClick={() => setSieger(null)} className="text-sand/50 hover:text-sand">
            zurück
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: cups }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => speichern(n)}
              disabled={pending}
              className="tabular rounded-lg border border-kante bg-tiefe py-3 text-lg font-semibold
                         hover:border-bernstein hover:bg-bernstein/15 active:scale-95
                         disabled:opacity-40 transition"
            >
              {n}
            </button>
          ))}
        </div>
        {fehler && <p className="mt-2 text-sm text-rot">{fehler}</p>}
      </div>
    );
  }

  /* Schritt 1: Sieger waehlen */
  return (
    <div>
      <div className="mb-2 text-sm text-sand/60">Wer hat gewonnen?</div>
      <div className="grid grid-cols-2 gap-2">
        {([["a", teamA], ["b", teamB]] as const).map(([seite, team]) => (
          <button
            key={seite}
            onClick={() => setSieger(seite)}
            disabled={pending}
            className="rounded-lg border border-kante bg-tiefe px-3 py-3 text-left
                       hover:border-duene hover:bg-duene/15 active:scale-95
                       disabled:opacity-40 transition"
          >
            <div className="truncate font-semibold">{team.name}</div>
            <div className="truncate text-xs text-sand/50">
              {team.player1}
              {team.player2 ? " & " + team.player2 : ""}
            </div>
          </button>
        ))}
      </div>
      {fehler && <p className="mt-2 text-sm text-rot">{fehler}</p>}
    </div>
  );
}
