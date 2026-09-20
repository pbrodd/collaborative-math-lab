import {
  ApiError,
  addTasks,
  authorize,
  createBook,
  failure,
  getDatabase,
  identity,
  payload,
  reply,
  short,
  snapshot,
  type BookRow,
  type MemberRow,
} from '../../../lib/server';
export async function GET(request: Request) {
  try {
    const { session, cookie } = await identity(request);
    const db = await getDatabase();
    const rows = await db
      .prepare(
        'SELECT b.id,b.kind,b.title,b.creator,b.updated_at,(SELECT COUNT(*) FROM members n WHERE n.book_id=b.id) AS members FROM books b JOIN members m ON b.id=m.book_id WHERE m.session_id=? ORDER BY b.updated_at DESC LIMIT 100',
      )
      .bind(session)
      .all();
    return reply({ books: rows.results }, cookie);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const input = await payload(request);
    const { session, cookie } = await identity(request);
    const db = await getDatabase();
    if (input.action === 'join') {
      const code = short(input.code, '').replace(/[\s-]/g, '').toUpperCase();
      if (code.length !== 10) throw new ApiError('Enter the 10-character room code.');
      const book = await db.prepare('SELECT * FROM books WHERE code=?').bind(code).first<BookRow>();
      if (!book) throw new ApiError('That room code wasn’t found.', 404);
      let member = await db
        .prepare('SELECT * FROM members WHERE book_id=? AND session_id=?')
        .bind(book.id, session)
        .first<MemberRow>();
      if (!member) {
        const count = await db
          .prepare('SELECT COUNT(*) AS n FROM members WHERE book_id=?')
          .bind(book.id)
          .first<{ n: number }>();
        if ((count?.n || 0) >= 8) throw new ApiError('This room already has eight members.');
        member = {
          id: crypto.randomUUID(),
          book_id: book.id,
          session_id: session,
          name: short(input.name, 'Explorer', 24),
          last_seen: Date.now(),
        };
        await db
          .prepare('INSERT INTO members (id,book_id,session_id,name,last_seen) VALUES (?,?,?,?,?)')
          .bind(member.id, book.id, session, member.name, member.last_seen)
          .run();
        if (book.kind === 'play')
          await addTasks(db, book.id, JSON.parse(book.document), member.id, true, book.revision);
      }
      return reply({ book: await snapshot(db, book, member) }, cookie);
    }
    if (input.action === 'remix' || input.action === 'test') {
      const { book } = await authorize(db, short(input.id, ''), session);
      return reply({ book: await createBook(db, session, input, book) }, cookie, 201);
    }
    if (input.action !== 'create') throw new ApiError('Choose a notebook, scenario, or room.');
    return reply({ book: await createBook(db, session, input) }, cookie, 201);
  } catch (e) {
    return failure(e);
  }
}
