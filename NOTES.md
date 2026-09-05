# NOTES.md

Live Server: https://take-home-project-260904.vercel.app

## Setup

Requirements: Node 20+, pnpm, and Postgres 17. Pick one path; the env file defaults match Docker, while `db:local-up` writes its own env files, so do not combine the two.

**With Docker:**

```bash
pnpm install
cp .env.example .env.local       # defaults match docker-compose.yml
docker compose up -d             # Postgres 17 on localhost:5432
pnpm db:reset                    # migrate + seed the demo data
pnpm dev                         # http://localhost:3000
```

**Without Docker:** `scripts/db-local.sh` runs a project-local cluster in `.pgdata` (port 5433, trust auth) that never touches an installed service and `pnpm db:local-up` writes `.env.local` and `.env.test` pointing at it:

```bash
pnpm install
pnpm db:local-up                 # starts the cluster, writes the env files
pnpm db:reset                    # migrate + seed the demo data
pnpm dev                         # http://localhost:3000
```

- No login. Use the "Switch demo user" selector in the header: one admin (`admin@demo.dev`) and two creators (`alice@demo.dev`, `bob@demo.dev`).
- `pnpm test` needs no extra setup: the Vitest global setup creates, migrates and truncates a dedicated `clipping_test` database automatically (Docker path uses the defaults in `.env.example`; the local path uses the `.env.test` that `db:local-up` wrote).
- `pnpm db:reset` drops and recreates both schema and data, so a clean demo state is one command. `pnpm ingest` fakes a daily metrics sync for approved clips.

## Concurrent approvals

The dangerous case: two admins approve the same submission, or two different submissions, at the same moment when the remaining budget only covers one of them. If both pass a read-then-write check, `budget_spent_cents` inflates beyond `total_budget_cents` and the campaign silently overpays.

Handled with a single atomic conditional UPDATE inside a transaction:

```sql
UPDATE campaign
SET budget_spent_cents = budget_spent_cents + $earnings
WHERE id = $campaignId
  AND budget_spent_cents + $earnings <= total_budget_cents
RETURNING budget_spent_cents, total_budget_cents;
```

Zero rows returned means the budget no longer covers this approval: the transaction aborts with a typed `BUDGET_EXCEEDED` error carrying `remainingCents`. The same transaction also guards the submission row (`UPDATE ... WHERE status = 'pending'`, abort if 0 rows, so the same submission cannot be approved twice) and computes the payout from the submission's latest metric row at approval time. That payout is not snapshotted into the schema: there is no per-submission payout column, so the strongly testable invariant is over the service's return values instead, `budget_spent_cents` moves by exactly the `payoutCents` each successful `approve` call returns and the tests assert exactly that (the value stays re-derivable from the same metric row anytime). When spent reaches total, the campaign flips to `completed` in the same transaction, which also prevents further approvals.

What I tried or ruled out:

- `SELECT ... FOR UPDATE` on the campaign row: correct, but holds the row lock for the whole transaction and serializes approvals even when they do not compete. The conditional UPDATE gets the same guarantee in one round trip.
- Application-level locking (in-process mutex): useless with multiple server instances, so it was never a real option.
- Relying on the DB unique constraint alone: it prevents double-approving one submission, but does not protect the shared budget counter, which is the actual money bug.

The concurrency test fires two `approve` calls with `Promise.allSettled` against a budget that covers only one and asserts exactly one succeeds and `budget_spent_cents` increased exactly once.




## What I left out on purpose

- **Payout rails (Stripe / bank transfers):** `paid` exists as a lifecycle state in the schema, but actual fund disbursement was omitted. Money flows strictly as integer cents accounting inside the database.
- **Approval rollbacks & audit logs:** Approvals are currently irreversible. An "unapprove" flow that restores the budget, along with an immutable `audit_log` table, were left out to keep the review transaction minimal and focused.
- **Admin bulk actions:** The review queue only supports individual approve/reject actions rather than batch operations.
- **i18n:** No mention of i18n in the brief, but I added it anyway. I hate adding it later.

## The first thing I would fix given another day

If given another day to extend this beyond the scope of the assignment, I would prioritize:

1. **Audit logging & reversibility (`unapprove`):** Approvals are currently irreversible. With real money involved, an operator needs an immutable `audit_log` table for compliance, along with an `unapprove` action that restores the campaign budget via an inverse atomic `UPDATE`.
2. **Real API ingestion & retry pipeline:** Replace the faked daily ingest with lightweight third-party API adapters (or scrapers) to pull real view counts automatically, backed by a persistent dead-letter queue (DLQ) in Postgres rather than console reporting.
3. **Multi-currency support:** The data model assumes a single implicit currency. A real-world marketplace needs explicit currency tagging per campaign. I intentionally avoided this to prevent premature complexity at this stage.
4. **Mobile responsiveness:** Development was focused desktop-first for the dense data tables and review queues. I would thoroughly audit and polish smaller viewport breakpoints.


## Where I used AI tooling and what I had to correct

I leveraged AI tooling through a phased, human-in-the-loop workflow rather than one-shot generation:

1. **Architecture & Scoping:** I first used a frontier model to help draft a comprehensive design document (`DESIGN.md`), defining the data model, edge cases, and strict scope limits before writing code.
2. **Phase-by-Phase Implementation:** I then used smaller, faster coding models to build out the project phase by phase (schema & migrations → tRPC routers → business logic → UI).
3. **Manual Audit & Corrections:** While AI excelled at boilerplate and repetitive code, I had to catch and steer several runtime and integration issues. Most notably:
   - **Session & Cookie Handling:** The initial generated auth flow mishandled cookie persistence and signatures during demo user switching, which I reworked to ensure reliable session swapping without full-page de-sync.
   - **Financial Invariants:** I had to manually balance the seed data to guarantee that the approval budget math cleanly demonstrated both ceiling rejection and automatic campaign completion.
