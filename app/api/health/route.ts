import { getDatabase } from '../../../db';

export async function GET() {
  try {
    const db = await getDatabase();
    await db.prepare('SELECT 1 AS ready').first();
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
