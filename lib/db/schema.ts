import { pgTable, serial, integer, text, timestamp, real, uniqueIndex } from 'drizzle-orm/pg-core';

// A user's life ledger.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Accounts are the handful of things a person says they care about —
// "Health", "Deep Work", "Relationships" — each with a target share of
// their time. This is the thing most trackers skip: a stated intention
// to reconcile actual behavior against.
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#2f4d3a'),
  targetPct: real('target_pct').notNull(), // stated priority, 0-100, should sum to ~100 across a user's accounts
  archived: integer('archived').notNull().default(0), // 0/1 — soft delete, keeps ledger history intact
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  userNameIdx: uniqueIndex('accounts_user_name_idx').on(t.userId, t.name),
}));

// Entries are the transactions: time actually spent, posted against an account.
export const entries = pgTable('entries', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  minutes: integer('minutes').notNull(),
  note: text('note').notNull().default(''),
  occurredAt: timestamp('occurred_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Phase 2: generated weekly statements get stored here so the dashboard
// can show statement history, not just the latest one.
export const statements = pgTable('statements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  body: text('body').notNull(), // the AI-generated narrative statement
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
