# Clipboard

A cut-down paid clipping marketplace: brands post campaigns, creators submit short-form clips (TikTok, Instagram, YouTube), and payouts are calculated per 1,000 views under a strict campaign budget ceiling.

**Live Demo:** [https://take-home-project-260904.vercel.app](https://take-home-project-260904.vercel.app)  
*Detailed design notes in [NOTES.md](./NOTES.md).*

*local dev uses Docker Postgres per the assignment, production demo uses Neon since hosting is unconstrained.*

---

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript (strict mode)
- **API:** tRPC v11
- **Database & ORM:** PostgreSQL 17, Drizzle ORM
- **Styling & UI:** TailwindCSS, shadcn/ui
- **Forms & Validation:** react-hook-form, Zod
- **Testing:** Vitest

---


## Quick start

Requires Node 20+, pnpm, and Postgres 17. Pick the path that matches your
machine; `.env.example` defaults match Docker, and `db:local-up` writes its own
env files, so do not combine the two.

**With Docker:**

```bash
pnpm install
cp .env.example .env.local        # defaults match docker-compose.yml
docker compose up -d              # start Postgres on localhost:5432
pnpm db:reset                     # migrate + seed demo data
```

**Without Docker** (project-local Postgres in `.pgdata`, port 5433, trust auth):

```bash
pnpm install
pnpm db:local-up                  # starts the cluster AND writes .env.local/.env.test
pnpm db:reset                     # migrate + seed demo data
```

Either way, finish with:

```bash
pnpm dev                          # http://localhost:3000
```



The app has no login: use the "Switch demo user" selector in the header to explore
as an admin or a creator. `pnpm ingest` fakes a daily metrics sync, and `pnpm test`
runs the suite against a dedicated test database.

## Scripts

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `pnpm dev`        | Dev server                                            |
| `pnpm test`       | Vitest suite (creates and migrates the test DB)       |
| `pnpm typecheck`  | `tsc --noEmit`                                        |
| `pnpm lint`       | ESLint                                                |
| `pnpm build`      | Production build                                      |
| `pnpm db:reset`   | Drop, migrate and seed the dev database               |
| `pnpm db:migrate` | Apply pending migrations                               |
| `pnpm db:seed`    | Seed demo data                                        |
| `pnpm db:generate`| Generate a new Drizzle migration (committed)          |
| `pnpm ingest`     | Fake daily metrics sync for approved submissions      |