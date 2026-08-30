import Link from "next/link";
import { notFound } from "next/navigation";
import { getState } from "@/lib/db";
import {
  addTeamAction,
  removeTeamAction,
  startTournamentAction,
  updateSettingsAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const state = await getState(slug);
  if (!state) notFound();

  const { tournament, teams } = state;
  const gestartet = tournament.status !== "setup";
  const spiele = teams.length >= 2 ? (teams.length * (teams.length - 1)) / 2 : 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8">
      <Link href={"/t/" + slug} className="text-sm text-sand/50 hover:text-sand">
        ← zum Turnier
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{tournament.name}</h1>
      <p className="mt-1 text-sand/60">Teams eintragen</p>

      {gestartet && (
        <p className="mt-4 rounded-lg border border-bernstein/40 bg-bernstein/10 px-4 py-3 text-sm">
          Das Turnier läuft bereits. Teams lassen sich jetzt nicht mehr ändern.
        </p>
      )}

      {/* Teamliste */}
      <ol className="mt-6 space-y-2">
        {teams.map((t, i) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-xl border border-kante bg-karte/50 px-4 py-3"
          >
            <span className="tabular w-6 shrink-0 text-sand/40">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{t.name}</div>
              <div className="truncate text-sm text-sand/50">
                {t.player1}
                {t.player2 ? " & " + t.player2 : " (allein)"}
              </div>
            </div>
            {!gestartet && (
              <form action={removeTeamAction.bind(null, slug, t.id)}>
                <button
                  type="submit"
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-sand/40
                             hover:bg-rot/15 hover:text-rot transition"
                  aria-label={"Team " + t.name + " entfernen"}
                >
                  ✕
                </button>
              </form>
            )}
          </li>
        ))}
        {teams.length === 0 && (
          <li className="rounded-xl border border-dashed border-kante px-4 py-8 text-center text-sand/40">
            Noch keine Teams. Trag unten das erste ein.
          </li>
        )}
      </ol>

      {!gestartet && (
        <>
          {/* Neues Team */}
          <form
            action={addTeamAction.bind(null, slug)}
            className="mt-4 rounded-2xl border border-kante bg-karte/60 p-5"
          >
            <h2 className="mb-3 font-semibold">Team hinzufügen</h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                name="player1"
                required
                placeholder="Spieler 1"
                className="rounded-lg border border-kante bg-tiefe px-3 py-2.5
                           outline-none focus:border-duene"
              />
              <input
                name="player2"
                placeholder="Spieler 2"
                className="rounded-lg border border-kante bg-tiefe px-3 py-2.5
                           outline-none focus:border-duene"
              />
            </div>
            <input
              name="name"
              placeholder="Teamname (optional — sonst beide Namen)"
              className="mt-3 w-full rounded-lg border border-kante bg-tiefe px-3 py-2.5
                         outline-none focus:border-duene"
            />
            <button
              type="submit"
              className="mt-3 w-full rounded-lg border border-duene px-4 py-2.5 font-semibold
                         text-duene-hell hover:bg-duene/15 transition"
            >
              + Team hinzufügen
            </button>
          </form>

          {/* Einstellungen */}
          <form
            action={updateSettingsAction.bind(null, slug)}
            className="mt-4 rounded-2xl border border-kante bg-karte/60 p-5"
          >
            <h2 className="mb-3 font-semibold">Einstellungen</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-sand/70">
                Tische
                <input
                  name="tableCount"
                  type="number"
                  min={1}
                  max={8}
                  defaultValue={tournament.tableCount}
                  className="tabular mt-1 w-full rounded-lg border border-kante bg-tiefe px-3 py-2.5
                             outline-none focus:border-duene"
                />
              </label>
              <label className="text-sm text-sand/70">
                Becher pro Spiel
                <input
                  name="cups"
                  type="number"
                  min={3}
                  max={21}
                  defaultValue={tournament.cups}
                  className="tabular mt-1 w-full rounded-lg border border-kante bg-tiefe px-3 py-2.5
                             outline-none focus:border-duene"
                />
              </label>
            </div>
            <button
              type="submit"
              className="mt-3 w-full rounded-lg border border-kante px-4 py-2.5 text-sand/80
                         hover:border-sand/50 transition"
            >
              Einstellungen speichern
            </button>
          </form>

          {/* Start */}
          <form action={startTournamentAction.bind(null, slug)} className="mt-6">
            <button
              type="submit"
              disabled={teams.length < 3}
              className="w-full rounded-xl bg-bernstein px-4 py-4 text-lg font-bold text-nacht
                         hover:brightness-110 active:scale-[0.99] transition
                         disabled:cursor-not-allowed disabled:opacity-30"
            >
              Auslosen & Turnier starten
            </button>
            <p className="mt-2 text-center text-sm text-sand/50">
              {teams.length < 3
                ? "Mindestens 3 Teams nötig — " + teams.length + " eingetragen."
                : teams.length +
                  " Teams · jeder gegen jeden ergibt " +
                  spiele +
                  " Gruppenspiele, dann Halbfinale und Finale."}
            </p>
          </form>
        </>
      )}
    </main>
  );
}
