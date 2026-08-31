# Nicolais Bierpong Tracker

Turnierverwaltung für Bierpong-Abende: Teams anlegen, auslosen, Ergebnisse vom
Handy eintragen, Tabelle und Endrunde laufen automatisch mit. Eine Vollbild-Ansicht
für den Fernseher gibt es dazu.

Erstmals im Einsatz war der Tracker am 30. August 2026.

**Live:** https://beerpong-nicola-koehler-s-projects.vercel.app
**Repo:** https://github.com/nicolaikoehler02-sys/beerpong

---

## Schnellstart

```bash
npm install
vercel env pull .env.local    # holt DATABASE_URL aus dem Vercel-Projekt
npm run dev                   # http://localhost:3000
```

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktionsbuild samt Typecheck |
| `npm run check` | 36 Checks der Turnierlogik, ohne Datenbank und Netz |
| `npm run migrate` | Spielt `db/schema.sql` ein (idempotent) |
| `npm run smoke -- <url>` | 35 Checks gegen eine laufende Instanz, räumt hinter sich auf |

Der Smoke-Test legt ein echtes Turnier in der Datenbank an und löscht es am Ende
wieder. Er lässt sich gefahrlos gegen Production laufen.

---

## Aufbau

```
lib/tournament.ts     Turnierlogik, frei von DB und React - hier liegt die Wahrheit
lib/db.ts             Datenzugriff (Neon Postgres über HTTP)
app/actions.ts        Server Actions: alle schreibenden Vorgänge
app/page.tsx          Startseite: Turnier anlegen, bisherige löschen
app/t/[slug]/         Live-Ansicht, /setup, /tv, /qr
components/           Client-Komponenten (Eingabe, Auto-Refresh, Tischsteuerung)
db/schema.sql         Datenbankschema
scripts/              check-tournament.ts, smoke.ts, migrate.ts
```

Die gesamte Turnierlogik in `lib/tournament.ts` ist bewusst rein: keine Imports aus
`db.ts` oder React. Deshalb deckt `npm run check` sie ohne Datenbank ab, und
Änderungen an Paarungen oder Tabelle lassen sich in Sekunden prüfen.

### Turnierformat

Gruppenphase als Round Robin nach der Kreismethode (jeder gegen jeden), danach
Halbfinale der besten Vier (1 gegen 4, 2 gegen 3), Finale und Spiel um Platz 3.
Bei ungerader Teamzahl ergänzt die Kreismethode einen Platzhalter, dessen Partien
als Freilos entfallen.

Tabellenwertung: 3 Punkte je Sieg, dann Becherdifferenz, dann geworfene Becher,
zuletzt der direkte Vergleich.

### Ergebniseingabe

Zwei Schritte: Sieger antippen, dann dessen **übrig gebliebene Becher** (1 bis
`cups`). Gefragt wird bewusst nach den übrigen Bechern des Siegers, weil genau
das am Tischende vor einem steht — niemand muss rückwärts rechnen. Gespeichert
wird daraus der übliche Score: Sieger `cups`, Verlierer `cups - übrig`.

### Live-Aktualisierung

Polling alle 3 Sekunden über `router.refresh()`, nicht WebSockets. Bei der
Handvoll Zuschauer eines Turnierabends völlig ausreichend und erheblich weniger
fehleranfällig. Im Hintergrund pausiert das Polling, um Handy-Akkus zu schonen.

Die TV-Seite hält per Wake Lock den Bildschirm wach, sonst geht der Fernseher
mitten im Turnier in den Standby.

### Restzeitschätzung

Kalibriert sich selbst: gemessen wird die reale Zeitspanne zwischen dem ersten
und letzten beendeten Spiel, geteilt durch deren Anzahl. Dadurch ist die
Parallelität mehrerer Tische bereits eingerechnet, ohne sie modellieren zu
müssen. Vor drei beendeten Spielen wird bewusst nichts angezeigt.

---

## Datenmodell

Drei Tabellen, `ON DELETE CASCADE` von `tournaments` abwärts:

- `tournaments` — slug, name, status (`setup`/`group`/`knockout`/`done`),
  table_count, cups, optionaler admin_pin
- `teams` — Name plus zwei Spieler (`player2` darf leer sein)
- `matches` — phase, round, position, beide Teams, Score, status
  (`pending`/`running`/`done`), table_no, updated_at

`updated_at` wird in jedem UPDATE explizit mitgeschrieben statt per Trigger.
Das hält die Migration frei von PL/pgSQL und damit über den HTTP-Client von
Neon ausführbar.

---

## Betrieb

Deployment über `vercel --prod`. Die Datenbank ist eine Neon-Instanz
(`neon-bronze-pillow`), über die Vercel-Marketplace-Integration provisioniert;
`DATABASE_URL` kommt als Umgebungsvariable aus dem Vercel-Projekt.

Zwei Fallstricke, die schon Zeit gekostet haben:

1. **Deployment Protection** muss für das Projekt aus bleiben. Ist sie an,
   leitet jeder Aufruf auf einen Vercel-Login um und niemand kommt auf die Seite.
2. **Commit-Autor.** Das Repo gehört dem privaten Account
   `nicolaikoehler02-sys`. Die globale git-Identität zeigt auf Hestura; deshalb
   ist in diesem Repo eine lokale Identität gesetzt. Commits unter der
   Hestura-Adresse lassen Vercel den Auto-Deploy blockieren.

---

## Stand und offene Punkte

Fertig und im Einsatz erprobt: Turnier anlegen, Teams verwalten, Auslosung,
Gruppenphase, automatische Endrunde, Ergebniseingabe mit Korrektur, Tabelle,
Tischverteilung samt manuellem Pausieren und Ansetzen, Fortschritt mit
Restzeit, Rekorde des Abends, QR-Aushang, TV-Ansicht, Turniere löschen.

Naheliegende nächste Schritte:

- **Doppel-K.o.** — bewusst zurückgestellt; das Loser-Bracket ist der größte
  Brocken in der Darstellung
- **Rangliste über mehrere Turniere** hinweg, wie es cuppr.de vormacht: dafür
  müssten Spieler eigene Datensätze bekommen statt bloßer Textfelder am Team
- **Admin-PIN** ist in Datenbank, Datenschicht und Actions vollständig
  umgesetzt, aber nie im Betrieb erprobt — bisher lief alles ohne PIN
- **Gleichzeitige Eingaben** überschreiben einander kommentarlos. Tragen zwei
  Leute dasselbe Spiel gleichzeitig ein, gewinnt der letzte Schreibvorgang.
  Bei einem Turnierabend verschmerzbar, bei mehr Andrang nicht.
- **Nur Tests, keine UI-Tests.** `npm run check` und `npm run smoke` decken
  Logik, Datenschicht und das Rendern aller Seiten ab. Die Knöpfe selbst
  — Ergebnis eintragen, pausieren, ansetzen — sind nie automatisiert geklickt
  worden.
