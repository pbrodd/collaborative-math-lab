import type { Database } from '../db/types';
import { editPlan, PlanningError, starterPlan, type Plan, type Planning } from './planning.ts';
type Row = { document: string; revision: number };
export async function readPlanning(db: Database, bookId: string): Promise<Planning | null> {
  const row = await db
    .prepare('SELECT document,revision FROM planning_boards WHERE book_id=?')
    .bind(bookId)
    .first<Row>();
  if (!row) return null;
  const reviews = await db
    .prepare(
      'SELECT id,plan_revision,author,verdict,note,document,created_at FROM planning_reviews WHERE book_id=? ORDER BY created_at',
    )
    .bind(bookId)
    .all<{
      id: string;
      plan_revision: number;
      author: string;
      verdict: 'approve' | 'changes';
      note: string;
      document: string;
      created_at: number;
    }>();
  return {
    plan: JSON.parse(row.document),
    reviews: reviews.results.map((r) => ({
      id: r.id,
      revision: r.plan_revision,
      author: r.author,
      verdict: r.verdict,
      note: r.note,
      plan: JSON.parse(r.document),
      createdAt: r.created_at,
    })),
  };
}
export async function mutatePlanning(
  db: Database,
  bookId: string,
  author: string,
  input: Record<string, unknown>,
) {
  if (input.action === 'plan-create') {
    const plan = starterPlan(input.template === 'blank');
    plan.updatedBy = author;
    const result = await db
      .prepare('INSERT OR IGNORE INTO planning_boards (book_id,revision,document) VALUES (?,0,?)')
      .bind(bookId, JSON.stringify(plan))
      .run();
    if (!result.meta.changes)
      throw new PlanningError('This workbook already has a planning board.', 409);
  } else if (input.action === 'plan-review') {
    if (
      typeof input.note !== 'string' ||
      input.note.trim().length < 12 ||
      input.note.length > 1500 ||
      !['approve', 'changes'].includes(input.verdict as string)
    )
      throw new PlanningError('Explain the route assumptions or timings you checked.');
    const result = await db
      .prepare(
        'INSERT INTO planning_reviews (id,book_id,plan_revision,author,verdict,note,document,created_at) SELECT ?,book_id,revision,?,?,?,document,? FROM planning_boards WHERE book_id=? AND revision=?',
      )
      .bind(
        crypto.randomUUID(),
        author,
        input.verdict,
        input.note.trim(),
        Date.now(),
        bookId,
        input.revision,
      )
      .run();
    if (!result.meta.changes)
      throw new PlanningError('The plan changed. Review the current version.', 409);
  } else if (input.action === 'plan-edit') {
    let saved = false;
    // Retry a board-level race only after checking the individual object's revision.
    // Independent edits merge; an edit to the same object produces a conflict.
    for (let attempt = 0; attempt < 5; attempt++) {
      const row = await db
        .prepare('SELECT document,revision FROM planning_boards WHERE book_id=?')
        .bind(bookId)
        .first<Row>();
      if (!row) throw new PlanningError('Create a planning board first.');
      const plan = editPlan(JSON.parse(row.document), input, author);
      const result = await db
        .prepare('UPDATE planning_boards SET document=?,revision=? WHERE book_id=? AND revision=?')
        .bind(JSON.stringify(plan), plan.revision, bookId, row.revision)
        .run();
      if (result.meta.changes) {
        saved = true;
        break;
      }
    }
    if (!saved)
      throw new PlanningError(
        'Several teammates are saving. Your draft is still here; try saving again.',
        409,
      );
  } else throw new PlanningError('Choose a planning action.');
  await db.prepare('UPDATE books SET updated_at=? WHERE id=?').bind(Date.now(), bookId).run();
}
export async function copyPlanning(db: Database, parentId: string, bookId: string, author: string) {
  const row = await db
    .prepare('SELECT document FROM planning_boards WHERE book_id=?')
    .bind(parentId)
    .first<Row>();
  if (!row) return;
  const plan = JSON.parse(row.document) as Plan;
  plan.revision = 0;
  plan.updatedBy = author;
  plan.settings.revision = 0;
  plan.markers.forEach((m) => {
    m.revision = 0;
  });
  plan.routes.forEach((r) => {
    r.revision = 0;
  });
  await db
    .prepare('INSERT INTO planning_boards (book_id,revision,document) VALUES (?,0,?)')
    .bind(bookId, JSON.stringify(plan))
    .run();
}
