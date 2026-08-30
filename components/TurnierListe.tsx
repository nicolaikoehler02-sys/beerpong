"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteTournamentAction } from "@/app/actions";

interface Eintrag {
  id: string;
  slug: string;
  name: string;
  status: string;
}

const STATUS_TEXT: Record<string, string> = {
  setup: "in Vorbereitung",
  group: "Gruppenphase",
  knockout: "Endrunde",
  done: "beendet",
};

/**
 * Liste der bisherigen Turniere mit Loeschmoeglichkeit.
 * Das Loeschen ist bewusst zweistufig: ein Turnier nimmt Teams und alle
 * Ergebnisse mit, und das laesst sich nicht rueckgaengig machen.
 */
export function TurnierListe({ turniere }: { turniere: Eintrag[] }) {
  const [nachfrage, setNachfrage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (turniere.length === 0) return null;

  const loeschen = (id: string) => {
    startTransition(async () => {
      await deleteTournamentAction(id);
      setNachfrage(null);
    });
  };

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm uppercase tracking-wider text-sand/50">
        Bisherige Turniere
      </h2>
      <ul className="space-y-2">
        {turniere.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-2 rounded-xl border border-kante bg-karte/40 pr-2
                       hover:border-duene/60 transition"
          >
            <Link href={"/t/" + t.slug} className="flex min-w-0 flex-1 items-center justify-between px-4 py-3">
              <span className="truncate font-medium">{t.name}</span>
              <span className="ml-3 shrink-0 text-xs text-sand/50">
                {STATUS_TEXT[t.status] ?? t.status}
              </span>
            </Link>

            {nachfrage === t.id ? (
              <span className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => loeschen(t.id)}
                  disabled={pending}
                  className="rounded-lg bg-rot px-2.5 py-1.5 text-xs font-semibold text-nacht
                             hover:brightness-110 disabled:opacity-50"
                >
                  {pending ? "..." : "wirklich löschen"}
                </button>
                <button
                  onClick={() => setNachfrage(null)}
                  disabled={pending}
                  className="rounded-lg px-2 py-1.5 text-xs text-sand/50 hover:text-sand"
                >
                  abbrechen
                </button>
              </span>
            ) : (
              <button
                onClick={() => setNachfrage(t.id)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm text-sand/35
                           hover:bg-rot/15 hover:text-rot transition"
                aria-label={"Turnier " + t.name + " löschen"}
                title="Turnier löschen"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-sand/40">
        Löschen entfernt das Turnier mit allen Teams und Ergebnissen endgültig.
      </p>
    </section>
  );
}
