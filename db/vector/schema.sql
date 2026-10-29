-- CloudLedger vector store (PostgreSQL + pgvector)
-- Run this against a PostgreSQL database with the pgvector extension available.

CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS support_tickets;

CREATE TABLE support_tickets (
  ticket_id  SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL,        -- references MySQL Clients.client_id (app-level FK, cross-database)
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  embedding  VECTOR(384) NOT NULL,    -- all-MiniLM-L6-v2 sentence-transformer output
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No ANN index on embedding: at demo/seed scale (a few dozen tickets) an
-- ivfflat index with any meaningful `lists` value starves each probe of
-- candidates and silently drops most true neighbors (very low recall).
-- A plain sequential scan with the <=> operator is exact and fast enough
-- below a few tens of thousands of rows. Add an ivfflat (or hnsw) index
-- back once the table is large enough to need it, sized as lists =
-- sqrt(row_count).

CREATE INDEX idx_support_tickets_client_id ON support_tickets (client_id);
