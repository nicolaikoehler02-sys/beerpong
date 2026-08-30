"use client";

import { useState, useTransition } from "react";
import { setTableAction } from "@/app/actions";
import type { Match, Team } from "@/lib/tournament";

/**
 * Stellt ein laufendes Spiel zurueck in die Warteschlange - fuer den Fall,
 * dass ein Team gerade nicht am Tisch steht. Der Tisch wird dadurch frei
 * und laesst sich mit einem wartenden Spiel neu belegen.
 */
export function SpielZuruecklegen({ slug, match }: { slug: string; match: Match }) {
  const [pending, startTransition] = useTransition();
  const [nachfrage, setNachfrage] = useState(false);

  if (nachfrage) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={() =>
            startTransition(async () => {
              await setTableAction(slug, match.id, null);
              setNachfrage(false);
            })
          }
          disabled={pending}
          className="rounded-lg bg-sand/20 px-2 py-1 text-xs font-semibold
                     hover:bg-sand/30 disabled:opacity-50"
        >
          {pending ? "..." : "Tisch freigeben"}
        </button>
        <button
          onClick={() => setNachfrage(false)}
          className="px-1.5 py-1 text-xs text-sand/50 hover:text-sand"
        >
          abbrechen
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setNachfrage(true)}
      className="rounded-lg border border-kante px-2 py-1 text-xs text-sand/50
                 hover:border-sand/50 hover:text-sand transition"
      title="Spiel zurück in die Warteschlange, z.B. wenn ein Team fehlt"
    >
      pausieren
    </button>
  );
}

/**
 * Setzt ein wartendes Spiel auf einen freien Tisch. Angeboten werden nur
 * Tische, die tatsaechlich frei sind, und nur fuer Spiele, deren Teams
 * nicht schon anderswo spielen.
 */
export function SpielAnsetzen({
  slug,
  match,
  freieTische,
  blockierteTeams,
}: {
  slug: string;
  match: Match;
  freieTische: number[];
  blockierteTeams: string[];
}) {
  const [pending, startTransition] = useTransition();

  const teamBeschaeftigt =
    (match.teamA !== null && blockierteTeams.includes(match.teamA)) ||
    (match.teamB !== null && blockierteTeams.includes(match.teamB));

  if (freieTische.length === 0) return null;

  if (teamBeschaeftigt) {
    return (
      <span className="shrink-0 text-xs text-sand/30" title="Ein Team spielt gerade schon">
        spielt bereits
      </span>
    );
  }

  return (
    <span className="flex shrink-0 flex-wrap gap-1">
      {freieTische.map((t) => (
        <button
          key={t}
          onClick={() =>
            startTransition(async () => {
              await setTableAction(slug, match.id, t);
            })
          }
          disabled={pending}
          className="rounded-lg border border-duene/60 px-2 py-1 text-xs font-medium
                     text-duene-hell hover:bg-duene/20 disabled:opacity-40 transition"
        >
          {pending ? "..." : "an Tisch " + t}
        </button>
      ))}
    </span>
  );
}
