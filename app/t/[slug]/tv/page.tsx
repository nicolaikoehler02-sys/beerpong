import { notFound } from "next/navigation";
import { getState } from "@/lib/db";
import { computeFortschritt, computeRekorde, computeTable } from "@/lib/tournament";
import { AutoRefresh, WakeLock } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

/**
 * Vollbild-Ansicht fuer den Fernseher (Spiegelung per AirPlay).
 * Auf 16:9 im Querformat ausgelegt, ohne Scrollen, mit grossen Schriften
 * fuer Leseabstand quer durch den Raum.
 */
export default async function TvSeite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const state = await getState(slug);
  if (!state) notFound();

  const { tournament, teams, matches } = state;
  const group = matches.filter((m) => m.phase === "group");
  const ko = matches.filter((m) => m.phase === "knockout");
  const table = computeTable(teams, group);
  const namen = new Map(teams.map((t) => [t.id, t]));

  const laufend = matches
    .filter((m) => m.status === "running")
    .sort((a, b) => (a.table ?? 0) - (b.table ?? 0));
  const naechste = matches
    .filter((m) => m.status === "pending" && m.teamA && m.teamB)
    .slice(0, 4);

  const finale = ko.find((m) => m.round === 2);
  const sieger =
    finale?.status === "done" && finale.scoreA !== null && finale.scoreB !== null
      ? namen.get(finale.scoreA > finale.scoreB ? finale.teamA! : finale.teamB!)
      : null;

  const fortschritt = computeFortschritt(matches);
  const rekorde = computeRekorde(teams, matches);
  const gespielt = fortschritt.gespielt;

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden px-8 py-6">
      <AutoRefresh seconds={3} />
      <WakeLock />

      <header className="mb-5 flex shrink-0 items-baseline justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-duene">
            Nicolais Bierpong Tracker
          </p>
          <h1 className="text-3xl font-bold">{tournament.name}</h1>
        </div>
        <div className="text-right">
          <p className="tabular text-sm text-sand/40">
            {gespielt} von {matches.length} Spielen
          </p>
          {fortschritt.restMinuten !== null && (
            <p className="tabular text-sm text-duene">
              noch etwa {restText(fortschritt.restMinuten)}
            </p>
          )}
        </div>
      </header>

      {sieger ? (
        <section className="flex flex-1 flex-col items-center justify-center">
          <p className="text-xl uppercase tracking-[0.3em] text-bernstein">
            Turniersieger
          </p>
          <p className="mt-4 text-7xl font-bold">{sieger.name}</p>
          <p className="mt-3 text-2xl text-sand/70">
            {sieger.player1}
            {sieger.player2 ? " & " + sieger.player2 : ""}
          </p>

          {rekorde.length > 0 && (
            <div className="mt-10 grid grid-cols-4 gap-4">
              {rekorde.map((rk) => (
                <div
                  key={rk.titel}
                  className="rounded-2xl border border-kante bg-karte/50 px-5 py-4 text-center"
                >
                  <div className="text-xs uppercase tracking-wider text-sand/40">
                    {rk.titel}
                  </div>
                  <div className="tabular mt-1 text-2xl font-bold">{rk.wert}</div>
                  <div className="truncate text-sm text-sand/50">{rk.detail}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-5 gap-6">
          {/* Links: laufende Spiele */}
          <section className="col-span-3 flex min-h-0 flex-col">
            <h2 className="mb-3 shrink-0 text-sm uppercase tracking-wider text-sand/40">
              Läuft gerade
            </h2>
            <div className="grid min-h-0 flex-1 auto-rows-fr gap-3">
              {laufend.map((m) => {
                const a = namen.get(m.teamA ?? "");
                const b = namen.get(m.teamB ?? "");
                return (
                  <article
                    key={m.id}
                    className="flex flex-col justify-center rounded-2xl border border-bernstein/50
                               bg-karte/70 px-6 py-4"
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <span className="rounded-md bg-bernstein px-2.5 py-0.5 text-sm font-bold text-nacht">
                        Tisch {m.table}
                      </span>
                      <span className="text-sm text-sand/40">{m.label}</span>
                    </div>
                    <div className="truncate text-3xl font-bold">{a?.name}</div>
                    <div className="my-1 text-lg text-sand/30">gegen</div>
                    <div className="truncate text-3xl font-bold">{b?.name}</div>
                  </article>
                );
              })}
              {laufend.length === 0 && (
                <div className="flex items-center justify-center rounded-2xl border border-dashed
                                border-kante text-xl text-sand/30">
                  Kein Spiel läuft
                </div>
              )}
            </div>

            {naechste.length > 0 && (
              <div className="mt-4 shrink-0">
                <h3 className="mb-2 text-sm uppercase tracking-wider text-sand/40">
                  Als nächstes
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {naechste.map((m) => (
                    <div
                      key={m.id}
                      className="truncate rounded-xl border border-kante bg-karte/30 px-4 py-2.5"
                    >
                      <span className="font-medium">{namen.get(m.teamA ?? "")?.name}</span>
                      <span className="mx-2 text-sand/30">gegen</span>
                      <span className="font-medium">{namen.get(m.teamB ?? "")?.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Rechts: Tabelle */}
          <section className="col-span-2 flex min-h-0 flex-col">
            <h2 className="mb-3 shrink-0 text-sm uppercase tracking-wider text-sand/40">
              {ko.length > 0 ? "Endstand Gruppenphase" : "Tabelle"}
            </h2>
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-kante">
              <table className="w-full text-lg">
                <thead className="bg-tiefe text-sm text-sand/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-2 py-2 text-left font-medium">Team</th>
                    <th className="tabular px-2 py-2 text-right font-medium">S</th>
                    <th className="tabular px-2 py-2 text-right font-medium">Diff</th>
                    <th className="tabular px-3 py-2 text-right font-medium">Pkt</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((r) => (
                    <tr
                      key={r.teamId}
                      className={
                        "border-t border-kante/50 " +
                        (r.rank <= 4 && teams.length > 4 ? "bg-duene/10" : "")
                      }
                    >
                      <td className="tabular px-3 py-2 text-sand/40">{r.rank}</td>
                      <td className="truncate px-2 py-2 font-medium">
                        {namen.get(r.teamId)?.name}
                      </td>
                      <td className="tabular px-2 py-2 text-right text-duene-hell">{r.wins}</td>
                      <td className="tabular px-2 py-2 text-right text-sand/50">
                        {r.diff > 0 ? "+" : ""}
                        {r.diff}
                      </td>
                      <td className="tabular px-3 py-2 text-right font-bold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {ko.length > 0 && (
              <div className="mt-4 shrink-0 space-y-2">
                <h3 className="text-sm uppercase tracking-wider text-sand/40">Endrunde</h3>
                {[...ko]
                  .sort((a, b) => a.round - b.round || a.position - b.position)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-xl border border-kante
                                 bg-karte/30 px-4 py-2"
                    >
                      <span className="truncate text-sm">
                        <span className="text-sand/40">{m.label}: </span>
                        {namen.get(m.teamA ?? "")?.name ?? "—"}
                        <span className="mx-1.5 text-sand/30">/</span>
                        {namen.get(m.teamB ?? "")?.name ?? "—"}
                      </span>
                      {m.status === "done" && (
                        <span className="tabular ml-2 shrink-0 font-bold">
                          {m.scoreA}:{m.scoreB}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

/** Wandelt Minuten in eine gut lesbare Angabe wie "1 Std 20 Min". */
function restText(minuten: number): string {
  if (minuten < 60) return minuten + " Min";
  const std = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest === 0 ? std + " Std" : std + " Std " + rest + " Min";
}
