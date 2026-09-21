import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { missionCardSet, missionCardsHtml, type CardOptions } from '../lib/mission-cards.ts';
import { analyze } from '../lib/algebra.ts';
import type { Book, Scenario } from '../lib/model.ts';

const options: CardOptions = {
  appearance: 'briefing',
  task: '',
  question: '',
  prediction: '',
  falsifier: '',
};
function fixture(): Book {
  const scenario = JSON.parse(
    readFileSync(new URL('../scenarios/siege.json', import.meta.url), 'utf8'),
  ).scenario as Scenario;
  scenario.tasks[0].intended = 'SECRET_AUTHOR_ANSWER';
  return {
    id: 'book',
    code: 'SECRET_ROOM_INVITATION',
    kind: 'play',
    title: 'A timing experiment',
    creator: 'Creator',
    source: { id: 'starter:siege', title: 'Original timing mission', creator: 'Original author' },
    document: scenario,
    revision: 2,
    created_at: 0,
    updated_at: 0,
    isOwner: true,
    me: 'a',
    members: [
      { id: 'a', name: 'Route owner', last_seen: 0 },
      { id: 'b', name: 'Reviewer', last_seen: 0 },
    ],
    reviews: [],
    contributions: [
      {
        task_id: 'route',
        owner_id: 'a',
        revision: 4,
        book_revision: 2,
        published: 1,
        reviewer_id: 'b',
        updated_at: 0,
        work: {
          steps: [{ equation: 't = 6', reason: 'SECRET_WORKING_DRAFT' }],
          answers: {},
          explanation: 'Measured route excludes the reset.',
          hints: 0,
          mode: 'notebook',
        },
      },
    ],
  };
}

test('cards carry only current published findings and distinguish peer review', () => {
  const book = fixture();
  let set = missionCardSet(
    book,
    { reset: '2', route_total: '32' },
    options,
    '2026-09-20T12:00:00Z',
  );
  assert.equal(set.cards[0].result, 't = 6');
  assert.equal(set.cards[0].equation, '4(t + (2)) = (32)');
  assert.equal(set.cards[0].status, 'Peer reviewed by Reviewer');
  assert.equal(set.cards[0].revision, 4);
  assert.match(set.cards[1].status, /Planning draft/);
  assert.match(set.source, /Original author/);
  book.contributions[0].reviewer_id = null;
  set = missionCardSet(book, {}, options);
  assert.equal(set.cards[0].status, 'Published · not peer reviewed');
  for (const patch of [{ published: 0 }, { published: 1, book_revision: 1 }]) {
    Object.assign(book.contributions[0], patch);
    const card = missionCardSet(book, {}, options).cards[0];
    assert.equal(card.result, '');
    assert.equal(card.explanation, '');
    assert.equal(card.revision, null);
    assert.match(card.status, /Planning draft/);
  }
});

test('artifacts omit hidden answers, private checks, room invitations, and unused draft text', () => {
  const book = fixture();
  book.contributions.push({
    ...structuredClone(book.contributions[0]),
    task_id: 'transfer:private:a',
    work: { ...structuredClone(book.contributions[0].work), explanation: 'SECRET_PRIVATE_CHECK' },
  });
  const html = missionCardsHtml(missionCardSet(book, {}, options));
  for (const secret of [
    'SECRET_AUTHOR_ANSWER',
    'SECRET_ROOM_INVITATION',
    'SECRET_WORKING_DRAFT',
    'SECRET_PRIVATE_CHECK',
    'Two paths, a fresh equation',
  ])
    assert.equal(html.includes(secret), false, secret);
  const selected = missionCardSet(book, {}, { ...options, task: 'route' });
  assert.equal(selected.cards.length, 1);
  assert.equal(selected.cards[0].role, 'Route analyst');
  assert.equal(missionCardSet(book, {}, { ...options, task: 'transfer' }).cards.length, 0);
});

test('student content stays text in printable HTML, including experiment prompts', () => {
  const book = fixture();
  const attack = '</script><img src=x onerror="alert(1)"><script>';
  book.title = attack;
  book.creator = attack;
  book.contributions[0].work.explanation = attack;
  const html = missionCardsHtml(
    missionCardSet(book, {}, { ...options, prediction: attack, falsifier: 'gap > 2 & same route' }),
  );
  assert.equal(html.includes(attack), false);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /gap &gt; 2 &amp; same route/);
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.equal((html.match(/<img/g) || []).length, 0);
  assert.match(html, /@media print/);
});

test('the planning example intersects a two-second arrival spread with the deadline', () => {
  const region = analyze('|s + 6 - 11| <= 2', ['s + 6 <= 12']);
  assert.notEqual(region.kind, 'unsupported');
  assert.equal(region.description, analyze('3 <= s <= 6').description);
});
