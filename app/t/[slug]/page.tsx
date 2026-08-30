import Link from "next/link";
import { notFound } from "next/navigation";
import { getState } from "@/lib/db";
import { computeTable, type Match, type Team } from "@/lib/tournament";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ScoreEntry } from "@/components/ScoreEntry";

export const dynamic = "force-dynamic";

export default async function TurnierSeite({
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
    .slice(0, 5);

  const finale = ko.find((m) => m.round === 2);
  const sieger =
    finale?.status === "done" && finale.scoreA !== null && finale.scoreB !== null
      ? namen.get(finale.scoreA > finale.scoreB ? finale.teamA! : finale.teamB!)
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-16">
      <AutoRefresh seconds={3} />

      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-duene">
            Dünencamping Amrum
          </p>
          <h1 className="truncate text-2xl font-bold sm:text-3xl">{tournament.name}</h1>
        </div>
        <nav className="flex shrink-0 gap-2 text-sm">
          <Link
            href={"/t/" + slug + "/qr"}
            className="rounded-lg border border-kante px-3 py-1.5 hover:border-duene transition"
          >
            QR
          </Link>
          <Link
            href={"/t/" + slug + "/tv"}
            className="rounded-lg border border-kante px-3 py-1.5 hover:border-duene transition"
          >
            TV
          </Link>
          <Link
            href={"/t/" + slug + "/setup"}
            className="rounded-lg border border-kante px-3 py-1.5 hover:border-duene transition"
          >
            Teams
          </Link>
        </nav>
      </header>

      {tournament.status === "setup" && (
        <div className="rounded-2xl border border-dashed border-kante px-5 py-10 text-center">
          <p className="text-sand/60">Das Turnier ist noch nicht ausgelost.</p>
          <Link
            href={"/t/" + slug + "/setup"}
            className="mt-3 inline-block rounded-lg bg-duene px-4 py-2 font-semibold text-nacht"
          >
            Teams eintragen
          </Link>
        </div>
      )}

      {sieger && (
        <section className="mb-6 rounded-2xl border border-bernstein bg-bernstein/15 px-5 py-6 text-center">
          <p className="text-sm uppercase tracking-widest text-bernstein">Turniersieger</p>
          <p className="mt-1 text-3xl font-bold">{sieger.name}</p>
          <p className="mt-1 text-sand/70">
            {sieger.player1}
            {sieger.player2 ? " & " + sieger.player2 : ""}
          </p>
        </section>
      )}

      {/* Laufende Spiele */}
      {laufend.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-sand/50">
            Läuft gerade
          </h2>
          <div className="space-y-3">
            {laufend.map((m) => (
              <article
                key={m.id}
                className="rounded-2xl border border-bernstein/50 bg-karte/70 p-4"
              >
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="rounded-md bg-bernstein/20 px-2 py-0.5 font-semibold text-bernstein">
                    Tisch {m.table}
                  </span>
                  <span className="text-sand/50">{m.label}</span>
                </div>
                <ScoreEntry slug={slug} match={m} teams={teams} cups={tournament.cups} />
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Endrunde */}
      {ko.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-sand/50">Endrunde</h2>
          <div className="space-y-2">
            {[...ko]
              .sort((a, b) => a.round - b.round || a.position - b.position)
              .map((m) => (
                <MatchZeile key={m.id} match={m} namen={namen} />
              ))}
          </div>
        </section>
      )}

      {/* Tabelle */}
      {group.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-sand/50">Tabelle</h2>
          <div className="overflow-x-auto rounded-2xl border border-kante">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-tiefe text-sand/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Team</th>
                  <th className="tabular px-2 py-2 text-right font-medium">Sp</th>
                  <th className="tabular px-2 py-2 text-right font-medium">S</th>
                  <th className="tabular px-2 py-2 text-right font-medium">N</th>
                  <th className="tabular px-2 py-2 text-right font-medium">Becher</th>
                  <th className="tabular px-2 py-2 text-right font-medium">Diff</th>
                  <th className="tabular px-3 py-2 text-right font-medium">Pkt</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r) => {
                  const team = namen.get(r.teamId);
                  const top4 = r.rank <= 4 && teams.length > 4;
                  return (
                    <tr
                      key={r.teamId}
                      className={
                        "border-t border-kante/60 " + (top4 ? "bg-duene/10" : "")
                      }
                    >
                      <td className="tabular px-3 py-2.5 text-sand/50">{r.rank}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{team?.name}</div>
                        <div className="text-xs text-sand/40">
                          {team?.player1}
                          {team?.player2 ? " & " + team.player2 : ""}
                        </div>
                      </td>
                      <td className="tabular px-2 py-2.5 text-right text-sand/60">{r.played}</td>
                      <td className="tabular px-2 py-2.5 text-right text-duene-hell">{r.wins}</td>
                      <td className="tabular px-2 py-2.5 text-right text-sand/50">{r.losses}</td>
                      <td className="tabular px-2 py-2.5 text-right text-sand/60">
                        {r.cupsFor}:{r.cupsAgainst}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right text-sand/60">
                        {r.diff > 0 ? "+" : ""}
                        {r.diff}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-bold">{r.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {teams.length > 4 && (
            <p className="mt-2 text-xs text-sand/40">
              Die ersten vier ziehen ins Halbfinale ein.
            </p>
          )}
        </section>
      )}

      {/* Warteschlange */}
      {naechste.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm uppercase tracking-wider text-sand/50">
            Als nächstes
          </h2>
          <div className="space-y-2">
            {naechste.map((m) => (
              <MatchZeile key={m.id} match={m} namen={namen} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function MatchZeile({
  match,
  namen,
}: {
  match: Match;
  namen: Map<string, Team>;
}) {
  const a = match.teamA ? namen.get(match.teamA)?.name : null;
  const b = match.teamB ? namen.get(match.teamB)?.name : null;
  const fertig = match.status === "done" && match.scoreA !== null;
  const aGewinnt = fertig && match.scoreA! > match.scoreB!;

  return (
    <div
      className={
        "flex items-center gap-3 rounded-xl border px-4 py-3 " +
        (match.status === "running"
          ? "border-bernstein/50 bg-bernstein/10"
          : "border-kante bg-karte/40")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-xs text-sand/40">{match.label}</div>
        <div className="flex items-baseline gap-2">
          <span
            className={
              "truncate " + (fertig && aGewinnt ? "font-semibold text-duene-hell" : "")
            }
          >
            {a ?? "—"}
          </span>
          <span className="shrink-0 text-xs text-sand/30">gegen</span>
          <span
            className={
              "truncate " + (fertig && !aGewinnt ? "font-semibold text-duene-hell" : "")
            }
          >
            {b ?? "—"}
          </span>
        </div>
      </div>
      {fertig ? (
        <div className="tabular shrink-0 text-lg font-bold">
          {match.scoreA}:{match.scoreB}
        </div>
      ) : match.status === "running" ? (
        <div className="puls shrink-0 text-xs font-semibold text-bernstein">
          Tisch {match.table}
        </div>
      ) : null}
    </div>
  );
}
