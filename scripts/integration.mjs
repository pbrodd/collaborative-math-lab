import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const origin = process.env.TEST_PUBLIC_ORIGIN || base;
function client() {
  let cookie = '';
  return async (path, body, method = 'POST', expected = 200) => {
    const response = await fetch(base + path, {
      method: body ? method : 'GET',
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
    return data;
  };
}
const alice = client(),
  bob = client(),
  outsider = client();
await alice('/api/books');
await bob('/api/books');
await outsider('/api/books');
let book = (
  await alice(
    '/api/books',
    { action: 'create', kind: 'play', template: 'brawl', playMode: 'team', name: 'Test author' },
    'POST',
    201,
  )
).book;
const id = book.id;
const path = `/api/books/${id}`;
const joined = (await bob('/api/books', { action: 'join', code: book.code, name: 'Test reviewer' }))
  .book;
const aid = book.me,
  bid = joined.me;
assert.notEqual(aid, bid);
assert.equal(joined.members.length, 2);
await outsider(path, undefined, 'GET', 403);
async function current(who = alice) {
  return (await who(path)).book;
}
async function claim(task, who = alice, owner = aid) {
  const b = await current(who),
    c = b.contributions.find((c) => c.task_id === task);
  return (await who(path, { action: 'assign', task, owner, revision: c.revision }, 'PATCH')).book;
}
function work(equation, answers = {}) {
  return {
    steps: [{ equation, reason: 'Applied equivalent operations to both sides.' }],
    answers,
    explanation: 'I checked the operations and units; this result fits the supplied data.',
    hints: 0,
    mode: 'notebook',
  };
}
async function publish(task, equation, who = alice, answers = {}) {
  const b = await current(who),
    c = b.contributions.find((c) => c.task_id === task);
  return (
    await who(
      path,
      {
        action: 'publish',
        task,
        revision: c.revision,
        bookRevision: b.revision,
        work: work(equation, answers),
      },
      'PATCH',
    )
  ).book;
}
async function review(task, who = bob, verdict = 'approve') {
  const b = await current(who),
    c = b.contributions.find((c) => c.task_id === task);
  return (
    await who(
      path,
      {
        action: 'review',
        task,
        revision: c.revision,
        verdict,
        note: 'I checked the original equation, both sides, and the meaning of the units.',
      },
      'PATCH',
    )
  ).book;
}
await claim('health');
await claim('shield', bob, bid);
await claim('upgrades');
await claim('combine');
await publish('health', 'h=6000');
await publish('shield', 'r=1/5', bob);
await publish('upgrades', 'u=(d-1800)/200');
book = await current();
let row = book.contributions.find((c) => c.task_id === 'combine');
await alice(
  path,
  {
    action: 'publish',
    task: 'combine',
    revision: row.revision,
    bookRevision: book.revision,
    work: work('d=2500', { upgrades: '4' }),
  },
  'PATCH',
  400,
);
row = book.contributions.find((c) => c.task_id === 'health');
await alice(
  path,
  {
    action: 'review',
    task: 'health',
    revision: row.revision,
    verdict: 'approve',
    note: 'I tried to approve my own result while a teammate was here.',
  },
  'PATCH',
  400,
);
await review('health');
await review('shield', alice);
await review('upgrades');
await publish('combine', 'd=2500', alice, { upgrades: '4' });
book = await review('combine');
assert.equal(book.contributions.find((c) => c.task_id === 'combine').reviewer_id, bid);
book = await review('health', bob, 'changes');
assert.equal(book.contributions.find((c) => c.task_id === 'combine').published, 0);
assert.equal(book.contributions.find((c) => c.task_id === 'health').reviewer_id, null);
assert.equal(
  book.contributions.find((c) => c.task_id === 'combine').work.steps.at(-1).equation,
  'd=2500',
);
book = await current();
row = book.contributions.find((c) => c.task_id === 'health');
const save = {
  action: 'save',
  task: 'health',
  revision: row.revision,
  bookRevision: book.revision,
  work: work('h=6000'),
};
await alice(path, save, 'PATCH');
await alice(path, save, 'PATCH', 409);
await bob(path, { ...save, revision: row.revision + 1 }, 'PATCH', 403);
console.log(
  '✓ Team sessions, role ownership, mathematical publishing, substantive reviews, invalidation, and write conflicts',
);
let source = (await alice('/api/books', { action: 'remix', id, name: 'Test author' }, 'POST', 201))
  .book;
assert.equal(source.kind, 'scenario');
assert.equal(source.source.id, id);
assert.equal(source.creator, 'Test author');
await bob('/api/books', { action: 'join', code: source.code, name: 'Coauthor' });
const draft = structuredClone(source.document);
draft.story = 'A new story authored together.';
draft.appearance = 'briefing';
const authorPath = `/api/books/${source.id}`;
await alice(
  authorPath,
  { action: 'document', document: draft, title: 'Coauthored remix', revision: 0 },
  'PATCH',
);
await bob(
  authorPath,
  { action: 'document', document: draft, title: 'Stale overwrite', revision: 0 },
  'PATCH',
  409,
);
assert.equal((await bob(authorPath)).book.title, 'Coauthored remix');
assert.equal((await bob(authorPath)).book.document.appearance, 'briefing');
await alice(
  authorPath,
  {
    action: 'document',
    document: { ...draft, appearance: 'unknown' },
    title: 'Invalid style',
    revision: 1,
  },
  'PATCH',
  400,
);
const testPlay = (
  await bob('/api/books', { action: 'test', id: source.id, name: 'Solver' }, 'POST', 201)
).book;
assert.equal(testPlay.kind, 'play');
assert.equal(testPlay.source.id, source.id);
assert.equal(testPlay.document.appearance, 'briefing');
const styledRemix = (
  await bob('/api/books', { action: 'remix', id: source.id, name: 'Remixer' }, 'POST', 201)
).book;
assert.equal(styledRemix.document.appearance, 'briefing');
assert.equal((await alice(authorPath)).book.kind, 'scenario');
console.log(
  '✓ Collaborative authoring, source attribution, remixing, and separate solver test-play',
);
let notebook = (
  await outsider(
    '/api/books',
    { action: 'create', kind: 'notebook', name: 'Notebook author' },
    'POST',
    201,
  )
).book;
const notebookPath = `/api/books/${notebook.id}`;
const doc = {
  type: 'notebook',
  appearance: 'briefing',
  cells: [
    {
      id: 'question',
      type: 'question',
      text: 'What if we change the starting point?',
      expression: '',
    },
    {
      id: 'graph',
      type: 'graph',
      text: 'Compare distances.',
      expression: 'y=|x-4|',
      min: -4,
      max: 10,
    },
  ],
};
await outsider(
  notebookPath,
  { action: 'document', title: 'Unfinished ideas', document: doc, revision: 0 },
  'PATCH',
);
assert.deepEqual((await outsider(notebookPath)).book.document, doc);
await alice(notebookPath, undefined, 'GET', 403);
let impossible = (
  await alice(
    '/api/books',
    { action: 'create', kind: 'scenario', name: 'Puzzle maker' },
    'POST',
    201,
  )
).book;
const puzzle = impossible.document;
const t = puzzle.tasks[0];
Object.assign(t, {
  title: 'Spot the contradiction',
  intro: 'Find whether any number satisfies both conditions.',
  equation: 'x>=4',
  constraints: ['x<4'],
  intended: 'no solution',
  intent: 'none',
});
await alice(
  `/api/books/${impossible.id}`,
  { action: 'document', title: 'An intentional contradiction', document: puzzle, revision: 0 },
  'PATCH',
);
const play = (
  await alice(
    '/api/books',
    { action: 'test', id: impossible.id, name: 'Puzzle solver' },
    'POST',
    201,
  )
).book;
const c = play.contributions[0];
await alice(
  `/api/books/${play.id}`,
  {
    action: 'publish',
    task: t.id,
    revision: c.revision,
    bookRevision: play.revision,
    work: work('no solution'),
  },
  'PATCH',
);
console.log('✓ Durable open notebooks and intentionally contradictory playable puzzles');
const siege = (
  await alice(
    '/api/books',
    { action: 'create', kind: 'play', template: 'siege', name: 'Timing tester' },
    'POST',
    201,
  )
).book;
const sp = `/api/books/${siege.id}`;
async function siegePublish(task, eq, answers = {}) {
  const b = (await alice(sp)).book;
  const c = b.contributions.find((c) => c.task_id === task);
  return (
    await alice(
      sp,
      {
        action: 'publish',
        task,
        revision: c.revision,
        bookRevision: b.revision,
        work: work(eq, answers),
      },
      'PATCH',
    )
  ).book;
}
await siegePublish('route', 't=6');
await siegePublish('arrival', 'a=20');
await siegePublish('deadline', 'b=21');
await siegePublish('combine', 's=12 or s=16', { earliest: '12', latest: '15' });
const end = (await alice(sp)).book;
assert.equal(end.contributions.find((c) => c.task_id === 'combine').published, 1);
console.log(
  '✓ Complete Siege mission, both absolute-value branches, and the final constrained interval',
);
console.log('✓ Existing algebra and notebook workflows passed.');
await alice(sp, { action: 'plan-create' }, 'PATCH');
await bob('/api/books', { action: 'join', code: siege.code, name: 'Map reviewer' });
await outsider(sp, { action: 'plan-create' }, 'PATCH', 403);
let planned = (await alice(sp)).book;
const originalPlan = planned.planning.plan;
await Promise.all([
  alice(
    sp,
    {
      action: 'plan-edit',
      kind: 'marker',
      id: 'alpha',
      revision: 0,
      object: { ...originalPlan.markers[0], x: 215 },
    },
    'PATCH',
  ),
  bob(
    sp,
    {
      action: 'plan-edit',
      kind: 'marker',
      id: 'bravo',
      revision: 0,
      object: { ...originalPlan.markers[1], y: 445 },
    },
    'PATCH',
  ),
]);
planned = (await alice(sp)).book;
assert.equal(planned.planning.plan.revision, 2);
assert.equal(planned.planning.plan.markers[0].x, 215);
assert.equal(planned.planning.plan.markers[1].y, 445);
assert.equal(planned.planning.plan.routes[0].needsMeasurement, true);
assert.equal(
  planned.contributions.find((c) => c.task_id === 'combine').published,
  1,
  'the board has separate timing data and revisions',
);
await bob(
  sp,
  {
    action: 'plan-edit',
    kind: 'marker',
    id: 'alpha',
    revision: 0,
    object: originalPlan.markers[0],
  },
  'PATCH',
  409,
);
await alice(
  sp,
  { action: 'plan-review', revision: 1, verdict: 'approve', note: 'Review of an outdated plan.' },
  'PATCH',
  409,
);
await bob(
  sp,
  {
    action: 'plan-review',
    revision: 2,
    verdict: 'changes',
    note: 'Measure the revised routes before using these timing estimates.',
  },
  'PATCH',
);
const revisedSettings = { ...originalPlan.settings, deadline: '15' };
await alice(
  sp,
  { action: 'plan-edit', kind: 'settings', id: 'settings', revision: 0, object: revisedSettings },
  'PATCH',
);
planned = (await bob(sp)).book;
assert.equal(planned.planning.reviews[0].plan.settings.deadline, '12');
assert.equal(planned.planning.plan.settings.deadline, '15');
for (const action of ['remix', 'test']) {
  const derived = (
    await alice('/api/books', { action, id: siege.id, name: 'Planner' }, 'POST', 201)
  ).book;
  assert.equal(derived.planning.plan.settings.deadline, '15');
  assert.equal(derived.planning.reviews.length, 0);
  assert.equal(derived.source.id, siege.id);
}
await outsider(notebookPath, { action: 'plan-create', template: 'blank' }, 'PATCH');
assert.equal((await outsider(notebookPath)).book.planning.plan.markers.length, 0);
console.log(
  '✓ Shared boards, independent concurrent edits, conflicts, route-estimate invalidation, reviewed snapshots, and board remix/test-play',
);
console.log(
  'All integration checks passed. Test workbooks were created on the selected test server.',
);
