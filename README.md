# CloudLedger

Cloud infrastructure allocation & automated billing system. A relational
core (MySQL) for accounts, provisioning, and billing integrity, paired with
a vector store (PostgreSQL + pgvector) for semantic search over support
tickets. See the original architecture spec for full rationale.

**Presenting this project?** See [`DEMO_GUIDE.md`](DEMO_GUIDE.md) for a
scripted walkthrough, demo accounts, and a feature-by-feature tour.

## Stack

- **App:** Next.js 16 (App Router, TypeScript, Tailwind v4, shadcn/ui)
- **Relational store:** MySQL 8 (`mysql2`)
- **Vector store:** PostgreSQL + pgvector (`pg`)
- **Auth:** NextAuth v5 (Credentials provider, bcrypt, JWT sessions)
- **Validation:** Zod on every API route, in addition to DB-level constraints
- **Embeddings:** `all-MiniLM-L6-v2` — Python/`sentence-transformers` for
  seeding, `@xenova/transformers` (same model, runs locally in Node/WASM) for
  query-time embeddings in the app

## Architecture

| Store | Tech | Holds | Why |
|---|---|---|---|
| Relational | MySQL 8 | Accounts, employees, roles, tiers, instances, usage logs, invoices | ACID transactions and FK integrity — money can't be eventually consistent. |
| Vector | PostgreSQL + pgvector | `support_tickets` embeddings | Free-text tickets need semantic similarity, not keyword match. |

### ER overview (crow's foot, textual)

```
Regions (1)---<(Data_Centers)
Data_Centers (1)---<(Server_Instances)
Clients (1)---<(Server_Instances)
Clients (1)---<(Invoices)
Subscription_Tiers (1)---<(Server_Instances)
Server_Instances (1)---<(Usage_Logs)
Clients (1)---<(Client_Access_Mapping)>---(1) Employees
Roles (1)---<(Client_Access_Mapping)
```

`Client_Access_Mapping` is the junction table resolving the Employees <->
Clients many-to-many relationship, carrying the employee's role for that
client (Admin employees are mapped to every client).

Full column-level detail: [`docs/data-dictionary.md`](docs/data-dictionary.md).

## Advanced database features (5)

1. Transactions — invoice generation (usage-cost sum + upsert) runs in one transaction.
2. Triggers — `trg_prevent_deploy_suspended_client`, `trg_close_usage_log_on_stop`.
3. View — `vw_client_current_bill`.
4. Stored procedure — `sp_generate_monthly_invoice(client_id, billing_month)`.
5. Indexing — composite index on `Server_Instances(client_id, current_status)`, index on `Usage_Logs(instance_id)`, and an index on `support_tickets.client_id`. Vector similarity search itself (exact cosine `<=>` scan — dataset is small enough that an ANN index would hurt recall) is also its own advanced feature.

## Setup

### 1. Prerequisites

- Node.js 20+
- MySQL 8 running locally (or reachable) — create/point at a `cloudledger` database
- PostgreSQL 15+ with the `pgvector` extension installed and reachable
- Python 3.10+ (only needed to run the one-time embedding seed script)

### 2. Environment variables

Copy the example and fill in real credentials:

```bash
cp .env.local.example .env.local
```

```
MYSQL_URL=mysql://user:password@localhost:3306/cloudledger
PGVECTOR_URL=postgresql://user:password@localhost:5432/cloudledger_vectors
NEXTAUTH_SECRET=<random 32-byte value, e.g. `openssl rand -base64 32`>
NEXTAUTH_URL=http://localhost:3000
```

### 3. MySQL — schema, objects, seed data

```bash
mysql -u root -p < db/mysql/schema.sql
mysql -u root -p < db/mysql/objects.sql
mysql -u root -p < db/mysql/seed.sql
```

Seed login (any of these, all share the password below):

| Email | Role | Scope |
|---|---|---|
| admin@cloudledger.dev | Admin | All clients |
| bilal@cloudledger.dev | DevOps | Initech LLC only |
| carmen@cloudledger.dev | Billing | Globex Corporation only |
| devon@cloudledger.dev | DevOps | Hooli Cloud only |

Password for all seed accounts: `Password123!`

### 4. PostgreSQL + pgvector — schema and embedded tickets

```bash
createdb cloudledger_vectors
psql cloudledger_vectors -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql cloudledger_vectors -f db/vector/schema.sql

cd db/vector
pip install -r requirements.txt
export PGVECTOR_URL="postgresql://user:password@localhost:5432/cloudledger_vectors"
python embed_and_seed.py
```

This downloads `all-MiniLM-L6-v2` once (cached locally, free/no API key) and
inserts 12 sample support tickets with 384-dim embeddings.

### 5. Install and run the app

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`.

## Demo queries

[`queries.sql`](queries.sql) has 10 queries against the MySQL schema: joins
across the IAM junction table, GROUP BY/HAVING on invoices, subqueries
(`IN`, correlated, scalar-in-SELECT), a query against `vw_client_current_bill`,
and a call to `sp_generate_monthly_invoice`.

## Pages

- `/login` — Credentials sign-in
- `/admin/dashboard` — Admin only (enforced in `proxy.ts` and every API route from the session JWT, never trusted from the client): all clients, instance counts by status, current-month running totals, paid revenue by month
- `/client/instances` — scoped to the signed-in employee's mapped client(s): list, start, stop, terminate instances
- `/client/billing` — invoice history, scoped the same way
- `/support` — submit a ticket, semantic-search past tickets (pgvector cosine similarity)

## Testing notes

- `npm run build` passes (TypeScript + lint clean).
- Manually verified: login with each seed account routes to the correct
  landing page and instance/billing lists are scoped to that account's
  mapped client(s); Admin sees all clients.
- Not covered by automated tests (out of scope per the spec): real payment
  processing and real VM provisioning are both simulated, matching the
  original architecture document.
- The `trg_prevent_deploy_suspended_client` trigger was exercised manually
  by attempting to insert a Server_Instances row for Umbrella Analytics
  (`account_status = 'Suspended'` in the seed data) and confirming MySQL
  raises `SIGNAL SQLSTATE '45000'`.

## Security

- Passwords are bcrypt-hashed at the application layer; plaintext is never stored.
- DB credentials live only in `.env.local` (gitignored); `.env.local.example` is the checked-in template.
- Every API route re-derives the caller's role/client scope from the server-side JWT session — never from client-supplied input.
- All SQL is parameterized (`mysql2`/`pg` placeholders) — no string-concatenated queries.
- Server-side Zod validation on every mutating API route, in addition to DB-level CHECK/FK/UNIQUE constraints.
