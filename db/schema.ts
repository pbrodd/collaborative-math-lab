import { sqliteTable, text, integer, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
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
