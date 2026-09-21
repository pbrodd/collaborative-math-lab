import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  starterPlan,
  validatePlan,
  editPlan,
  schedule,
  timingQuestion,
  milliseconds,
  seconds,
  type PlanRoute,
} from '../lib/planning.ts';
import { analyze } from '../lib/algebra.ts';
import { planningSvg, planningDocument } from '../lib/planning-art.ts';
import { mutatePlanning, readPlanning, copyPlanning } from '../lib/planning-storage.ts';
import { openSqlite } from '../db/sqlite.ts';

test('practice routes meet the pairwise window and produce the complete local start interval', () => {
  const plan = validatePlan(starterPlan());
  const times = schedule(plan);
  assert.equal(times.feasible, true);
  assert.equal(times.finish, 11000);
  assert.equal(times.stages[0].spread, 2000);
  const q = timingQuestion(plan, 'route-a')!;
  assert.equal(analyze(q.equation, q.constraints).description, analyze('3 <= s <= 6').description);
  assert.equal(milliseconds('0.1') + milliseconds('0.2'), 300);
  assert.equal(seconds(300), '0.3');
  assert.equal(seconds(10000), '10');
  for (const bad of ['-1', '0.0001', '1/0', 'Infinity', '3601', 's', '1e3'])
    assert.throws(() => milliseconds(bad));
});

test('a local solution cannot conceal a conflict between two other arrivals', () => {
  const p = starterPlan();
  p.routes[1].travel = '10';
  p.routes[2].travel = '12';
  const q = timingQuestion(p, 'route-a')!;
  assert.equal(analyze(q.equation, q.constraints).description, analyze('no solution').description);
  assert.equal(schedule(p).feasible, false);
});

test('later stages wait for every prerequisite, including its setup time', () => {
  const p = starterPlan();
  p.settings.deadline = '30';
  p.markers.push({
    id: 'final',
    revision: 0,
    kind: 'objective',
    label: '2A',
    x: 400,
    y: 350,
    stage: 2,
  });
  p.routes[3].setup = '1';
  p.routes.push({
    id: 'final-route',
    revision: 0,
    label: 'Stage two',
    owner: 'Alpha',
    from: 'obj-a',
    to: 'final',
    via: [],
    after: ['route-a', 'route-d'],
    travel: '3',
    setup: '2',
    delay: '1',
  });
  const item = schedule(validatePlan(p)).results.find((r) => r.route.id === 'final-route')!;
  assert.equal(item.base, 12000);
  assert.equal(item.start, 13000);
  assert.equal(item.ready, 18000);
  p.routes[0].after = ['final-route'];
  assert.throws(() => validatePlan(p), /earlier stage/);
});

test('geometry changes invalidate route estimates and conflicting route drafts', () => {
  const p = starterPlan();
  const moved = editPlan(
    p,
    { kind: 'marker', id: 'alpha', revision: 0, object: { ...p.markers[0], x: 230 } },
    'Alice',
  );
  assert.equal(moved.routes[0].needsMeasurement, true);
  assert.equal(moved.routes[0].revision, 1);
  assert.equal(schedule(moved).feasible, false);
  assert.throws(
    () =>
      editPlan(moved, { kind: 'route', id: 'route-a', revision: 0, object: p.routes[0] }, 'Bob'),
    /teammate changed/,
  );
  const checked = editPlan(
    moved,
    {
      kind: 'route',
      id: 'route-a',
      revision: 1,
      object: { ...moved.routes[0], needsMeasurement: false },
    },
    'Bob',
  );
  assert.equal(schedule(checked).feasible, true);
  assert.equal(p.markers[0].x, 195, 'the original snapshot is unchanged');
  assert.throws(() =>
    editPlan(p, { kind: 'marker', id: 'alpha', revision: 0, remove: true }, 'Alice'),
  );
  const invalid = starterPlan();
  invalid.markers[0].x = NaN;
  assert.throws(() => validatePlan(invalid));
});

test('SVG and offline cards escape student labels and carry the symbol license', () => {
  const p = starterPlan();
  const attack = '"><script>alert(1)</script><img src=x onerror=alert(1)>';
  p.markers[0].label = attack;
  p.routes[0].label = attack;
  p.settings.notes = attack;
  const svg = planningSvg(p, '', true);
  assert.equal(svg.includes('<script>'), false);
  assert.equal(svg.includes('<img'), false);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /data:image\/svg\+xml/);
  const html = planningDocument({ plan: p, reviews: [] }, attack, 'Creator', 'Original author');
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.match(html, /Permission is hereby granted/);
  assert.match(html, /Milsymbol 3\.0\.4/);
  assert.match(html, /Original author/);
});

test('persistent planning merges independent edits, rejects conflicts, and retains exact reviewed snapshots', async () => {
  const db = openSqlite(':memory:');
  try {
    await db.prepare('CREATE TABLE books (id TEXT PRIMARY KEY, updated_at INTEGER)').run();
    const migration = readFileSync(
      new URL('../drizzle/0001_giant_captain_britain.sql', import.meta.url),
      'utf8',
    );
    for (const sql of migration.split('--> statement-breakpoint'))
      await db.prepare(sql.trim()).run();
    await db.prepare('INSERT INTO books VALUES (?,0)').bind('original').run();
    await db.prepare('INSERT INTO books VALUES (?,0)').bind('remix').run();
    await mutatePlanning(db, 'original', 'Alice', { action: 'plan-create' });
    const initial = (await readPlanning(db, 'original'))!.plan;
    await Promise.all([
      mutatePlanning(db, 'original', 'Alice', {
        action: 'plan-edit',
        kind: 'marker',
        id: 'alpha',
        revision: 0,
        object: { ...initial.markers[0], x: 220 },
      }),
      mutatePlanning(db, 'original', 'Bob', {
        action: 'plan-edit',
        kind: 'marker',
        id: 'bravo',
        revision: 0,
        object: { ...initial.markers[1], y: 450 },
      }),
    ]);
    let current = (await readPlanning(db, 'original'))!;
    assert.equal(current.plan.revision, 2);
    assert.equal(current.plan.markers[0].x, 220);
    assert.equal(current.plan.markers[1].y, 450);
    await assert.rejects(
      mutatePlanning(db, 'original', 'Bob', {
        action: 'plan-edit',
        kind: 'marker',
        id: 'alpha',
        revision: 0,
        object: initial.markers[0],
      }),
      /teammate changed/,
    );
    await assert.rejects(
      mutatePlanning(db, 'original', 'Bob', {
        action: 'plan-review',
        revision: 1,
        note: 'Stale review must not be accepted.',
        verdict: 'approve',
      }),
      /plan changed/,
    );
    await mutatePlanning(db, 'original', 'Bob', {
      action: 'plan-review',
      revision: 2,
      note: 'The new route estimates need to be measured.',
      verdict: 'changes',
    });
    const oldSettings = current.plan.settings;
    await mutatePlanning(db, 'original', 'Alice', {
      action: 'plan-edit',
      kind: 'settings',
      id: 'settings',
      revision: 0,
      object: { ...oldSettings, title: 'A revised plan' },
    });
    current = (await readPlanning(db, 'original'))!;
    assert.equal(current.plan.revision, 3);
    assert.equal(current.reviews[0].revision, 2);
    assert.equal(current.reviews[0].plan.settings.title, initial.settings.title);
    await copyPlanning(db, 'original', 'remix', 'Remixer');
    const remix = (await readPlanning(db, 'remix'))!;
    assert.equal(remix.plan.revision, 0);
    assert.equal(remix.plan.settings.title, 'A revised plan');
    assert.equal(remix.reviews.length, 0, 'old approvals are not inherited by a remix');
  } finally {
    db.close();
  }
});
