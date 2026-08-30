-- Schema fuer das Bierpong-Turnier.
-- Idempotent: laesst sich gefahrlos mehrfach ausfuehren.

CREATE TABLE IF NOT EXISTS tournaments (
  id           TEXT PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  -- 'setup' = Teams werden erfasst, 'group' = Gruppenphase, 'knockout' = Endrunde, 'done' = beendet
  status       TEXT NOT NULL DEFAULT 'setup',
  table_count  INTEGER NOT NULL DEFAULT 2,
  -- Becher pro Spiel; bestimmt den Score, ab dem ein Spiel gewonnen ist
  cups         INTEGER NOT NULL DEFAULT 10,
  -- Optionaler PIN: ist er gesetzt, duerfen nur damit Ergebnisse geaendert werden
  admin_pin    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id            TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  player1       TEXT NOT NULL,
  player2       TEXT,
  seed          INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teams_tournament_idx ON teams(tournament_id);

CREATE TABLE IF NOT EXISTS matches (
  id            TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  phase         TEXT NOT NULL,               -- 'group' | 'knockout'
  round         INTEGER NOT NULL,
  position      INTEGER NOT NULL,
  label         TEXT NOT NULL,
  team_a        TEXT REFERENCES teams(id) ON DELETE SET NULL,
  team_b        TEXT REFERENCES teams(id) ON DELETE SET NULL,
  score_a       INTEGER,
  score_b       INTEGER,
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'done'
  table_no      INTEGER,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, phase, round, position)
);

CREATE INDEX IF NOT EXISTS matches_tournament_idx ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(tournament_id, status);

-- Hinweis: updated_at wird bewusst in jedem UPDATE explizit mitgeschrieben
-- statt per Trigger. Das haelt die Migration frei von PL/pgSQL und damit
-- ausfuehrbar ueber den HTTP-Client von Neon.
