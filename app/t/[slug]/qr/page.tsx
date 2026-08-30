import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getState } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Aushang zum Ausdrucken oder Danebenlegen: QR-Code plus Adresse zum Abtippen.
 * Die Basis-URL kommt aus dem Request-Header, damit der Code auch dann stimmt,
 * wenn spaeter eine eigene Domain davorhaengt.
 */
export default async function QrSeite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const state = await getState(slug);
  if (!state) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protokoll = host.startsWith("localhost") ? "http" : "https";
  const url = protokoll + "://" + host + "/t/" + slug;

  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: "#0a1d28", light: "#f2ebdb" },
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <p className="text-sm uppercase tracking-[0.3em] text-duene">
        Nicolais Bierpong Tracker
      </p>
      <h1 className="mt-2 text-center text-3xl font-bold">{state.tournament.name}</h1>
      <p className="mt-2 text-center text-sand/60">
        Handy-Kamera drauf halten, Ergebnisse eintragen
      </p>

      <div
        className="mt-8 w-full max-w-xs rounded-2xl bg-sand-hell p-5 [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <p className="mt-6 break-all text-center font-mono text-sm text-sand/70">{url}</p>

      <p className="mt-8 max-w-sm text-center text-xs text-sand/40">
        Diese Seite lässt sich ausdrucken und an den Tisch hängen. Über
        <span className="font-mono"> /tv </span>
        gibt es die Vollbild-Ansicht für den Fernseher.
      </p>
    </main>
  );
}
