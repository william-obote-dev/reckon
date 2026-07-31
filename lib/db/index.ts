import * as schema from './schema';

// Two code paths, same schema, same query API:
//
// - DATABASE_URL set (production, pointed at Neon) → real Postgres over
//   the network via the `postgres` driver.
// - DATABASE_URL unset (local dev) → an embedded Postgres that runs
//   in-process via WASM (@electric-sql/pglite). No local Postgres install,
//   no Docker, no account needed to start building.
//
// Both are genuinely Postgres, so SQL behavior (including things like
// `real` column math and timestamps) matches between dev and prod —
// unlike a SQLite-for-dev / Postgres-for-prod split, which can silently
// diverge.

let dbInstance: any;

async function getDb() {
  if (dbInstance) return dbInstance;

  if (process.env.DATABASE_URL) {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const client = postgres(process.env.DATABASE_URL, { max: 5 });
    dbInstance = drizzle(client, { schema });
  } else {
    console.warn('[db] No DATABASE_URL set — using an embedded local Postgres (./.data/reckon). Fine for development; set DATABASE_URL (Neon) for anything deployed.');
    const fs = await import('fs');
    if (!fs.existsSync('./.data')) fs.mkdirSync('./.data', { recursive: true });
    const { drizzle } = await import('drizzle-orm/pglite');
    const { PGlite } = await import('@electric-sql/pglite');
    const client = new PGlite('./.data/reckon');
    await migrateLocal(client); // raw client: .exec() allows multi-statement SQL, drizzle's .execute() doesn't
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

// Local dev only: create tables directly instead of requiring drizzle-kit
// migrations to run first, so `npm run dev` works immediately on a fresh
// clone. Production uses real migrations (see package.json `db:migrate`).
async function migrateLocal(client: any) {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#2f4d3a',
      target_pct REAL NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      minutes INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      occurred_at TIMESTAMP NOT NULL DEFAULT now(),
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS statements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_start TIMESTAMP NOT NULL,
      period_end TIMESTAMP NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
}

export { getDb };
