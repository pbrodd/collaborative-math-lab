import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  primaryKey,
  index,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const authUsers = sqliteTable(
  'auth_users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    recoveryHash: text('recovery_hash').notNull(),
    credentialVersion: integer('credential_version').notNull().default(0),
    role: text('role').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [check('auth_user_role', sql`${t.role} IN ('admin','student')`)],
);
export const authSessions = sqliteTable(
  'auth_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id),
    credentialVersion: integer('credential_version').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('auth_session_user').on(t.userId)],
);
export const authInvites = sqliteTable('auth_invites', {
  tokenHash: text('token_hash').primaryKey(),
  createdBy: text('created_by')
    .notNull()
    .references(() => authUsers.id),
  label: text('label').notNull(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedBy: text('used_by').references(() => authUsers.id),
  revoked: integer('revoked').notNull().default(0),
});
export const authSetup = sqliteTable(
  'auth_setup',
  {
    id: integer('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id),
  },
  (t) => [check('auth_setup_singleton', sql`${t.id}=1`)],
);
export const authLimits = sqliteTable('auth_limits', {
  bucket: text('bucket').primaryKey(),
  attempts: integer('attempts').notNull(),
  startedAt: integer('started_at').notNull(),
});
export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  creator: text('creator').notNull(),
  owner: text('owner').notNull(),
  source: text('source'),
  document: text('document').notNull(),
  revision: integer('revision').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    sessionId: text('session_id').notNull(),
    name: text('name').notNull(),
    lastSeen: integer('last_seen').notNull(),
  },
  (t) => [uniqueIndex('member_session').on(t.bookId, t.sessionId)],
);
export const contributions = sqliteTable(
  'contributions',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    taskId: text('task_id').notNull(),
    ownerId: text('owner_id'),
    work: text('work').notNull(),
    revision: integer('revision').notNull().default(0),
    bookRevision: integer('book_revision').notNull().default(0),
    published: integer('published').notNull().default(0),
    reviewerId: text('reviewer_id'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.taskId] })],
);
export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  taskId: text('task_id').notNull(),
  memberId: text('member_id').notNull(),
  workRevision: integer('work_revision').notNull(),
  verdict: text('verdict').notNull(),
  note: text('note').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const planningBoards = sqliteTable('planning_boards', {
  bookId: text('book_id')
    .primaryKey()
    .references(() => books.id),
  revision: integer('revision').notNull().default(0),
  document: text('document').notNull(),
});
export const planningReviews = sqliteTable('planning_reviews', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  planRevision: integer('plan_revision').notNull(),
  author: text('author').notNull(),
  verdict: text('verdict').notNull(),
  note: text('note').notNull(),
  document: text('document').notNull(),
  createdAt: integer('created_at').notNull(),
});
