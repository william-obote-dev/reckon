# Reckon — a ledger for your life

Most trackers ask what you want to do. Reckon asks where your time
actually went, and holds it up against what you said mattered — the way
a bank statement doesn't ask what you meant to spend, it just shows what
happened.

**The model:** you define a small set of **accounts** — the handful of
things you actually care about (Health, Deep Work, Relationships...) —
each with a **target allocation** (e.g. "Health should get ~25% of my
time"). You log **entries** as you go: quick, 10-second records of what
you did and for how long, posted against an account like a transaction.
Reckon reconciles the two and shows you the gap — which accounts are
running a deficit relative to what you claim matters, not just what you
did in absolute terms.

Built to be a real, long-term product: Phase 1 (this repo, working today)
is the ledger core. Phase 2 adds AI-generated weekly statements and trend
forecasting. Phase 3 adds calendar auto-import and richer entry capture.

## Stack

- **Next.js 16** (App Router, TypeScript) — frontend + API in one framework, deploys to Vercel
- **Postgres via [Neon](https://neon.tech)** — free serverless Postgres, branching for safe schema changes
- **Drizzle ORM** — typed schema in `lib/db/schema.ts`, same queries against Neon in prod and an embedded local Postgres in dev
- **Claude API** — Phase 2, generates the weekly narrative statements

> Next.js 16's App Router has diverged meaningfully from older tutorials
> (route handlers, `params` as a Promise, etc.) — if you're extending this
> with an AI coding tool, point it at this repo's actual code rather than
> assuming it matches what's in a model's training data.

## Local development

No account or setup needed to start — a local run automatically uses an
embedded Postgres (via `@electric-sql/pglite`, WASM, no install):

```bash
npm install
cp .env.example .env.local
# set JWT_SECRET to any long random string; leave DATABASE_URL blank
npm run dev
```

Open `http://localhost:3000`. Your local data lives in `./.data/` (gitignored).

## How the reconciliation works

`GET /api/dashboard?days=7` is the core of the product:

1. Sum minutes logged per account over the window.
2. Compute each account's actual share of total logged time.
3. Compare that against the account's stated `targetPct`.
4. `balance = actualPct - targetPct` — negative means the account is
   running a deficit (you said it mattered, your ledger disagrees);
   positive means it's getting more than its stated share.

Accounts are sorted worst-deficit-first, so opening the dashboard puts
the thing you're most neglecting at the top — on purpose.

## Data model

```
users        — accounts (auth), one per person
accounts     — the "categories" a user defines, each with a target %
entries      — logged time, posted against one account
statements   — Phase 2: stored AI-generated weekly narratives
```

Deleting an account soft-deletes it (`archived = 1`) rather than dropping
its rows, so historical entries and past statements stay intact even
after someone reshapes their categories.

## Deploying (Neon + Vercel)

**1. Create a free Neon database** at [neon.tech](https://neon.tech) — new
project, copy the connection string it gives you (starts with
`postgres://`).

**2. Run migrations against it:**
```bash
DATABASE_URL="<your neon connection string>" npm run db:generate
DATABASE_URL="<your neon connection string>" npm run db:migrate
```

**3. Deploy to Vercel:**
- Push this repo to GitHub, import it on [vercel.com](https://vercel.com)
- It'll detect Next.js automatically — no config needed
- Add environment variables in the Vercel dashboard:
  - `JWT_SECRET` — long random string
  - `DATABASE_URL` — your Neon connection string
- Deploy

Unlike the SQLite-file approach from an earlier project, there's no
persistent-disk concern here — Neon is the database, Vercel is stateless
by design, and that's the correct shape for this stack rather than a
workaround.

## Roadmap

**Phase 2 — weekly statements.** A Vercel Cron job (`vercel.json`, run
weekly) calls a route that pulls the past week's entries and account
targets, sends them to Claude, and stores a generated narrative statement
("You said Health mattered most this quarter, but it ran a deficit every
week except one — here's what shifted...") in the `statements` table.
Surface statement history on the dashboard.

**Phase 3 — richer capture.** Calendar import (Google Calendar API) to
auto-suggest entries instead of manual logging; recurring entries for
habits; a lightweight mobile capture flow (PWA or a proper native shell)
since the whole model depends on logging being fast enough to actually do.

**Later:** shareable read-only statement links; multi-user households
sharing certain accounts (e.g. a couple both logging against "Family
time"); data export.

## What's deliberately not built yet

Auth is a hand-rolled JWT-in-httpOnly-cookie setup, same pattern as
before — fine for one person's product, but if this grows multi-tenant
or needs SSO, swap it for Auth.js or Clerk rather than extending this by
hand. Nothing else in the app depends on how auth is implemented — every
route just calls `getUserId(req)`.
