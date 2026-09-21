import {
  ApiError,
  authorize,
  failure,
  getDatabase,
  identity,
  payload,
  reply,
  short,
  snapshot,
  validateDocument,
  validateWork,
  type WorkRow,
  type MemberRow,
} from '../../../../lib/server';
import {
  assessTask,
  resolveTask,
  scenarioValues,
  type Contribution,
  type Scenario,
} from '../../../../lib/model';
import { mutatePlanning } from '../../../../lib/planning-storage';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { session, cookie } = await identity(request);
    const db = await getDatabase();
    const { book, member } = await authorize(db, id, session);
    await db.prepare('UPDATE members SET last_seen=? WHERE id=?').bind(Date.now(), member.id).run();
    return reply({ book: await snapshot(db, book, member) }, cookie);
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const input = await payload(request);
    const { id } = await context.params;
    const { session, cookie } = await identity(request);
    const db = await getDatabase();
    const { book, member } = await authorize(db, id, session);
    const now = Date.now();
    if (typeof input.action === 'string' && input.action.startsWith('plan-')) {
      await mutatePlanning(db, id, member.name, input);
      return reply({ book: await snapshot(db, book, member) }, cookie);
    }
    if (input.action === 'document') {
      if (book.kind === 'play')
        throw new ApiError(
          'Remix this scenario to edit it. Existing solver work stays with this playthrough.',
        );
      const document = validateDocument(input.document);
      if ((book.kind === 'notebook') !== (document.type === 'notebook'))
        throw new ApiError('Keep the current workbook type.');
      const title = short(input.title, book.title);
      const result = await db
        .prepare(
          'UPDATE books SET document=?,title=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',
        )
        .bind(JSON.stringify(document), title, now, id, input.revision)
        .run();
      if (!result.meta.changes)
        throw new ApiError(
          'A teammate saved a newer draft. Reload it before applying your changes; your draft is still on screen.',
          409,
        );
      book.document = JSON.stringify(document);
      book.title = title;
      book.revision++;
      book.updated_at = now;
      return reply({ book: await snapshot(db, book, member) }, cookie);
    }
    if (book.kind !== 'play') throw new ApiError('Open a playthrough to solve role tasks.');
    const scenario = JSON.parse(book.document) as Scenario;
    const requested = short(input.task, '');
    const definition = scenario.tasks.find((t) => t.id === requested);
    if (!definition) throw new ApiError('Task not found.', 404);
    const taskId = definition.kind === 'transfer' ? `${requested}:private:${member.id}` : requested;
    const existing = await db
      .prepare('SELECT * FROM contributions WHERE book_id=? AND task_id=?')
      .bind(id, taskId)
      .first<WorkRow>();
    if (!existing) throw new ApiError('Task not found.', 404);
    if (input.action === 'assign') {
      if (existing.owner_id && existing.owner_id !== member.id && book.owner !== session)
        throw new ApiError('Ask the task owner or workbook creator for a handoff.', 403);
      if (definition.kind === 'transfer')
        throw new ApiError('Everyone owns their own independent check.');
      const owner = input.owner === null ? null : short(input.owner, member.id);
      if (
        owner &&
        !(await db
          .prepare('SELECT id FROM members WHERE book_id=? AND id=?')
          .bind(id, owner)
          .first<MemberRow>())
      )
        throw new ApiError('Choose a member of this room.');
      const result = await db
        .prepare(
          'UPDATE contributions SET owner_id=?,revision=revision+1,reviewer_id=NULL WHERE book_id=? AND task_id=? AND revision=?',
        )
        .bind(owner, id, taskId, input.revision)
        .run();
      if (!result.meta.changes)
        throw new ApiError('This task changed. Reload before assigning it.', 409);
    } else if (input.action === 'review' || input.action === 'reply') {
      const note = short(input.note, '', 1500);
      if (note.length < 12)
        throw new ApiError('Explain what you checked or what needs another look.');
      const verdict =
        input.action === 'reply' ? 'reply' : input.verdict === 'changes' ? 'changes' : 'approve';
      if (verdict !== 'reply') {
        if (!existing.published || existing.book_revision !== book.revision)
          throw new ApiError('Publish a checked solution first.');
        const count = await db
          .prepare('SELECT COUNT(*) AS n FROM members WHERE book_id=?')
          .bind(id)
          .first<{ n: number }>();
        if (existing.owner_id === member.id && (count?.n || 0) > 1)
          throw new ApiError('Ask a teammate to review your explanation.');
        const result = await db
          .prepare(
            'UPDATE contributions SET reviewer_id=? WHERE book_id=? AND task_id=? AND revision=? AND published=1',
          )
          .bind(verdict === 'approve' ? member.id : null, id, taskId, input.revision)
          .run();
        if (!result.meta.changes)
          throw new ApiError('The author changed this result. Review the latest work.', 409);
      }
      await db
        .prepare(
          'INSERT INTO reviews (id,book_id,task_id,member_id,work_revision,verdict,note,created_at) VALUES (?,?,?,?,?,?,?,?)',
        )
        .bind(crypto.randomUUID(), id, taskId, member.id, existing.revision, verdict, note, now)
        .run();
      if (verdict === 'changes') {
        const affected = new Set<string>([requested]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const t of scenario.tasks)
            if (!affected.has(t.id) && t.dependencies.some((k) => affected.has(k))) {
              affected.add(t.id);
              changed = true;
            }
        }
        const downstream = [...affected].filter((k) => k !== requested);
        if (downstream.length)
          await db.batch(
            downstream.map((k) =>
              db
                .prepare(
                  'UPDATE contributions SET published=0,reviewer_id=NULL,revision=revision+1 WHERE book_id=? AND task_id=?',
                )
                .bind(id, k),
            ),
          );
      }
    } else if (input.action === 'save' || input.action === 'publish') {
      if (existing.owner_id !== member.id)
        throw new ApiError('Take this role before editing it.', 403);
      if (input.bookRevision !== book.revision)
        throw new ApiError('The scenario changed. Reload before saving.', 409);
      const work = validateWork(input.work);
      const raw = await db
        .prepare('SELECT * FROM contributions WHERE book_id=?')
        .bind(id)
        .all<WorkRow>();
      const contributions = raw.results.map((r) => ({
        ...r,
        work: JSON.parse(r.work),
      })) as Contribution[];
      const values = scenarioValues(scenario, contributions, false, book.revision);
      const task = resolveTask(definition, values);
      const publishing = input.action === 'publish';
      if (publishing) {
        const count = await db
          .prepare('SELECT COUNT(*) AS n FROM members WHERE book_id=?')
          .bind(id)
          .first<{ n: number }>();
        if (
          definition.dependencies.some(
            (dep) =>
              !contributions.some(
                (c) =>
                  c.task_id === dep &&
                  c.published &&
                  c.book_revision === book.revision &&
                  ((count?.n || 0) === 1 || (!!c.reviewer_id && c.reviewer_id !== c.owner_id)),
              ),
          )
        )
          throw new ApiError(
            'Publish and peer-review the prerequisite role results first. Solo work can proceed after publishing.',
          );
        const check = assessTask(task, work);
        if (!check.checked) throw new ApiError(check.message);
      }
      const result = await db
        .prepare(
          'UPDATE contributions SET work=?,revision=revision+1,book_revision=?,published=?,reviewer_id=NULL,updated_at=? WHERE book_id=? AND task_id=? AND revision=? AND owner_id=?',
        )
        .bind(
          JSON.stringify(work),
          book.revision,
          publishing ? 1 : 0,
          now,
          id,
          taskId,
          input.revision,
          member.id,
        )
        .run();
      if (!result.meta.changes)
        throw new ApiError('A newer version is saved. Reload it before replacing your draft.', 409);
      // Any edit to an input invalidates every downstream publication, preserving their work.
      const impacted = new Set<string>([requested]);
      let added = true;
      while (added) {
        added = false;
        for (const t of scenario.tasks)
          if (!impacted.has(t.id) && t.dependencies.some((k) => impacted.has(k))) {
            impacted.add(t.id);
            added = true;
          }
      }
      const dependent = [...impacted].filter((k) => k !== requested);
      if (dependent.length)
        await db.batch(
          dependent.map((k) =>
            db
              .prepare(
                'UPDATE contributions SET published=0,reviewer_id=NULL,revision=revision+1 WHERE book_id=? AND task_id=?',
              )
              .bind(id, k),
          ),
        );
    } else throw new ApiError('That action is unavailable.');
    await db.prepare('UPDATE books SET updated_at=? WHERE id=?').bind(now, id).run();
    book.updated_at = now;
    return reply({ book: await snapshot(db, book, member) }, cookie);
  } catch (e) {
    return failure(e);
  }
}
