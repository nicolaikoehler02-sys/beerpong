import { listTournaments } from "@/lib/db";
import { TurnierListe } from "@/components/TurnierListe";
import { createTournamentAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const turniere = await listTournaments();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <header className="mb-10">
        <p className="text-sm uppercase tracking-[0.2em] text-duene">
          Nicolais
        </p>
        <h1 className="mt-1 text-4xl font-bold text-sand-hell">Bierpong Tracker</h1>
        <p className="mt-2 text-sand/60">
          Turnier anlegen, Teams eintragen, loslegen.
        </p>
      </header>

      <section className="rounded-2xl border border-kante bg-karte/60 p-6">
        <h2 className="mb-4 text-lg font-semibold">Neues Turnier</h2>
        <form action={createTournamentAction} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm text-sand/70">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              defaultValue="Bierpong-Turnier"
              className="w-full rounded-lg border border-kante bg-tiefe px-3 py-2.5
                         outline-none focus:border-duene"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="tableCount" className="mb-1 block text-sm text-sand/70">
                Tische
              </label>
              <input
                id="tableCount"
                name="tableCount"
                type="number"
                min={1}
                max={8}
                defaultValue={2}
                className="tabular w-full rounded-lg border border-kante bg-tiefe px-3 py-2.5
                           outline-none focus:border-duene"
              />
            </div>
            <div>
              <label htmlFor="cups" className="mb-1 block text-sm text-sand/70">
                Becher pro Spiel
              </label>
              <input
                id="cups"
                name="cups"
                type="number"
                min={3}
                max={21}
                defaultValue={10}
                className="tabular w-full rounded-lg border border-kante bg-tiefe px-3 py-2.5
                           outline-none focus:border-duene"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pin" className="mb-1 block text-sm text-sand/70">
              Admin-PIN <span className="text-sand/40">— leer lassen, dann darf jeder eintragen</span>
            </label>
            <input
              id="pin"
              name="pin"
              inputMode="numeric"
              placeholder="z.B. 1234"
              className="tabular w-full rounded-lg border border-kante bg-tiefe px-3 py-2.5
                         outline-none focus:border-duene"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-duene px-4 py-3 font-semibold text-nacht
                       hover:bg-duene-hell active:scale-[0.99] transition"
          >
            Turnier anlegen
          </button>
        </form>
      </section>

      <TurnierListe turniere={turniere} />
    </main>
  );
}
