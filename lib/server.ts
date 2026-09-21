import { scenarioCatalog } from '../scenarios/catalog';
import { applicationOrigin } from './origin';
import { ApiError } from './api-error';
import { requireUser } from './auth';
export { ApiError };
import { validateDocument, ValidationError } from './validation';
import { PlanningError } from './planning';
import { readPlanning, copyPlanning } from './planning-storage';
export { validateDocument };
import { getDatabase, type Database } from '../db';
import { emptyWork, type Work } from './missions';
import {
  blankScenario,
  starterScenario,
  type Document,
  type Scenario,
  type Attribution,
} from './model';
export type BookRow = {
  id: string;
  code: string;
  kind: 'notebook' | 'scenario' | 'play';
  title: string;
  creator: string;
  owner: string;
  source: string | null;
  document: string;
  revision: number;
  created_at: number;
  updated_at: number;
};
export type MemberRow = {
  id: string;
  book_id: string;
  session_id: string;
  name: string;
  last_seen: number;
};
export type WorkRow = {
  book_id: string;
  task_id: string;
  owner_id: string | null;
  work: string;
  revision: number;
  book_revision: number;
  published: number;
  reviewer_id: string | null;
  updated_at: number;
};
export async function identity(request: Request) {
  const user = await requireUser(await getDatabase(), request);
  return { session: user.id, cookie: undefined };
}
export function reply(data: unknown, cookie?: string | string[], status = 200) {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  for (const value of typeof cookie === 'string' ? [cookie] : (cookie ?? []))
    headers.append('Set-Cookie', value);
  return Response.json(data, { status, headers });
}
export function failure(e: unknown) {
  if (e instanceof PlanningError) return reply({ error: e.message }, undefined, e.status);
  if (e instanceof ValidationError) return reply({ error: e.message }, undefined, 400);
  if (e instanceof ApiError) return reply({ error: e.message }, undefined, e.status);
  console.error('Workbook request failed', e);
  return reply(
    { error: 'That change could not be saved. Your draft is still on screen; try again.' },
    undefined,
    500,
  );
}
export async function payload(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin');
  if (origin && origin !== applicationOrigin(request.url))
    throw new ApiError('Make changes from this application.', 403);
  const text = await request.text();
  if (text.length > 250000) throw new ApiError('This update is too large.', 413);
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new ApiError('The update could not be read.');
  }
}
export function short(value: unknown, fallback: string, max = 100) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;
}
export function validateWork(value: unknown): Work {
  if (!value || typeof value !== 'object') throw new ApiError('Work is missing.');
  const w = value as Work;
  if (
    !Array.isArray(w.steps) ||
    w.steps.length > 30 ||
    w.steps.some(
      (s) =>
        typeof s.equation !== 'string' ||
        s.equation.length > 240 ||
        typeof s.reason !== 'string' ||
        s.reason.length > 240,
    ) ||
    !w.answers ||
    typeof w.answers !== 'object' ||
    Object.values(w.answers).some((v) => typeof v !== 'string' || v.length > 100) ||
    typeof w.explanation !== 'string' ||
    w.explanation.length > 3000 ||
    !['build', 'guide', 'notebook'].includes(w.mode)
  )
    throw new ApiError('Keep the solution to 30 short steps and an explanation.');
  return {
    steps: w.steps.map((s) => ({ equation: s.equation, reason: s.reason })),
    answers: w.answers,
    explanation: w.explanation,
    hints: Number.isInteger(w.hints) ? Math.max(0, Math.min(3, w.hints)) : 0,
    mode: w.mode,
  };
}
export async function authorize(db: Database, id: string, session: string) {
  const [book, member] = await Promise.all([
    db.prepare('SELECT * FROM books WHERE id=?').bind(id).first<BookRow>(),
    db
      .prepare('SELECT * FROM members WHERE book_id=? AND session_id=?')
      .bind(id, session)
      .first<MemberRow>(),
  ]);
  if (!book || !member) throw new ApiError('Join this workbook with its room code first.', 403);
  return { book, member };
}
export async function snapshot(db: Database, book: BookRow, member: MemberRow) {
  const [roster, works, reviews] = await Promise.all([
    db
      .prepare('SELECT id,name,last_seen FROM members WHERE book_id=? ORDER BY name')
      .bind(book.id)
      .all(),
    db.prepare('SELECT * FROM contributions WHERE book_id=?').bind(book.id).all<WorkRow>(),
    db
      .prepare(
        'SELECT id,task_id,member_id,work_revision,verdict,note,created_at FROM reviews WHERE book_id=? ORDER BY created_at',
      )
      .bind(book.id)
      .all(),
  ]);
  return {
    ...book,
    planning: await readPlanning(db, book.id),
    owner: undefined,
    source: book.source ? JSON.parse(book.source) : null,
    document: JSON.parse(book.document),
    isOwner: book.owner === member.session_id,
    me: member.id,
    members: roster.results,
    reviews: reviews.results.filter(
      (r) =>
        !(r.task_id as string).includes(':private:') ||
        (r.task_id as string).endsWith(`:private:${member.id}`),
    ),
    contributions: works.results
      .filter((w) => !w.task_id.includes(':private:') || w.owner_id === member.id)
      .map((w) => ({ ...w, work: JSON.parse(w.work) })),
  };
}
export async function addTasks(
  db: Database,
  bookId: string,
  document: Scenario,
  memberId: string,
  team: boolean,
  revision = 0,
) {
  const now = Date.now();
  await db.batch(
    document.tasks.map((t) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO contributions (book_id,task_id,owner_id,work,book_revision,updated_at) VALUES (?,?,?,?,?,?)',
        )
        .bind(
          bookId,
          t.kind === 'transfer' ? `${t.id}:private:${memberId}` : t.id,
          t.kind === 'transfer' || !team ? memberId : null,
          JSON.stringify(emptyWork()),
          revision,
          now,
        ),
    ),
  );
}
export async function createBook(
  db: Database,
  session: string,
  input: Record<string, unknown>,
  parent?: BookRow,
) {
  let kind: BookRow['kind'] =
    input.kind === 'notebook' ? 'notebook' : input.kind === 'scenario' ? 'scenario' : 'play';
  let document: Document;
  let source: Attribution | null = null;
  if (parent) {
    document = JSON.parse(parent.document);
    kind =
      input.action === 'test' ? 'play' : document.type === 'notebook' ? 'notebook' : 'scenario';
    source = { id: parent.id, title: parent.title, creator: parent.creator };
    if (kind === 'play' && document.type !== 'scenario')
      throw new ApiError('Only scenarios can be test-played.');
  } else if (kind === 'notebook')
    document = {
      type: 'notebook',
      cells: [{ id: crypto.randomUUID(), type: 'question', text: '', expression: '' }],
    };
  else if (
    typeof input.template === 'string' &&
    scenarioCatalog.some((s) => s.id === input.template)
  ) {
    const template = scenarioCatalog.find((s) => s.id === input.template)!;
    document = starterScenario(input.template);
    source = { id: `starter:${input.template}`, title: template.title, creator: template.creator };
  } else document = blankScenario();
  const now = Date.now(),
    id = crypto.randomUUID(),
    memberId = crypto.randomUUID(),
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from(
    crypto.getRandomValues(new Uint8Array(10)),
    (b) => alphabet[b % alphabet.length],
  ).join('');
  const name = short(input.name, 'Explorer', 24);
  const title = short(
    input.title,
    parent
      ? `${parent.title}${input.action === 'test' ? ' · playthrough' : ' · remix'}`
      : kind === 'notebook'
        ? 'An unfinished idea'
        : input.template === 'brawl'
          ? 'The three-hit question'
          : input.template === 'siege'
            ? 'Every second counts'
            : 'My new scenario',
  );
  const book: BookRow = {
    id,
    code,
    kind,
    title,
    creator: parent && input.action === 'test' ? parent.creator : name,
    owner: session,
    source: source ? JSON.stringify(source) : null,
    document: JSON.stringify(document),
    revision: 0,
    created_at: now,
    updated_at: now,
  };
  const member: MemberRow = {
    id: memberId,
    book_id: id,
    session_id: session,
    name,
    last_seen: now,
  };
  await db.batch([
    db
      .prepare(
        'INSERT INTO books (id,code,kind,title,creator,owner,source,document,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      )
      .bind(id, code, kind, title, book.creator, session, book.source, book.document, now, now),
    db
      .prepare('INSERT INTO members (id,book_id,session_id,name,last_seen) VALUES (?,?,?,?,?)')
      .bind(memberId, id, session, name, now),
  ]);
  if (kind === 'play' && document.type === 'scenario')
    await addTasks(db, id, document, memberId, input.playMode === 'team');
  if (parent) await copyPlanning(db, parent.id, id, name);
  return snapshot(db, book, member);
}
export { getDatabase };
