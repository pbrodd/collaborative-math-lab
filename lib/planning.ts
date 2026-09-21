export type Point = { x: number; y: number };
export type PlanMarker = Point & {
  id: string;
  revision: number;
  kind: 'player' | 'objective';
  label: string;
  stage: number;
};
export type PlanRoute = {
  id: string;
  revision: number;
  label: string;
  owner: string;
  from: string;
  to: string;
  via: Point[];
  travel: string;
  setup: string;
  delay: string;
  after: string[];
  needsMeasurement?: boolean;
};
export type PlanSettings = {
  id: 'settings';
  revision: number;
  title: string;
  tolerance: string;
  deadline: string;
  notes: string;
};
export type Plan = {
  revision: number;
  map: 'relay-station-v1';
  updatedBy: string;
  settings: PlanSettings;
  markers: PlanMarker[];
  routes: PlanRoute[];
};
export type PlanReview = {
  id: string;
  revision: number;
  author: string;
  verdict: 'approve' | 'changes';
  note: string;
  createdAt: number;
  plan: Plan;
};
export type Planning = { plan: Plan; reviews: PlanReview[] };
export type PlanObject = PlanMarker | PlanRoute | PlanSettings;
export class PlanningError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function milliseconds(value: string): number {
  if (typeof value !== 'string' || !/^\d{1,4}(?:\.\d{1,3})?$/.test(value) || Number(value) > 3600)
    throw new PlanningError('Use seconds from 0 to 3600, with up to three decimal places.');
  return Math.round(Number(value) * 1000);
}
export const seconds = (ms: number) => (ms / 1000).toFixed(3).replace(/\.?0+$/, '') || '0';
// Integer milliseconds keep all schedule arithmetic exact at the supplied precision.
export function starterPlan(blank = false): Plan {
  const markers: PlanMarker[] = [
    { id: 'alpha', revision: 0, kind: 'player', label: 'Alpha', x: 195, y: 465, stage: 1 },
    { id: 'bravo', revision: 0, kind: 'player', label: 'Bravo', x: 610, y: 465, stage: 1 },
    { id: 'charlie', revision: 0, kind: 'player', label: 'Charlie', x: 755, y: 350, stage: 1 },
    { id: 'delta', revision: 0, kind: 'player', label: 'Delta', x: 45, y: 350, stage: 1 },
    { id: 'obj-a', revision: 0, kind: 'objective', label: '1A · Relay', x: 195, y: 150, stage: 1 },
    {
      id: 'obj-b',
      revision: 0,
      kind: 'objective',
      label: '1B · Lookout',
      x: 415,
      y: 150,
      stage: 1,
    },
    {
      id: 'obj-c',
      revision: 0,
      kind: 'objective',
      label: '1C · Signals',
      x: 615,
      y: 150,
      stage: 1,
    },
  ];
  const route = (
    id: string,
    from: string,
    to: string,
    travel: string,
    delay: string,
    via: Point[],
  ): PlanRoute => ({
    id,
    revision: 0,
    label: `${from} route`,
    owner: '',
    from,
    to,
    travel,
    delay,
    via,
    setup: '0',
    after: [],
  });
  return {
    revision: 0,
    map: 'relay-station-v1',
    updatedBy: '',
    settings: {
      id: 'settings',
      revision: 0,
      title: blank ? 'Our operation' : 'Operation: Harbor Relay',
      tolerance: '2',
      deadline: '12',
      notes:
        'Invented practice times. All clocks begin at the shared countdown zero. Reach each stage’s objectives within two seconds of one another. Route lines are a sketch; check doors and obstacles with your team.',
    },
    markers: blank ? [] : markers,
    routes: blank
      ? []
      : [
          route('route-a', 'alpha', 'obj-a', '6', '3', [
            { x: 225, y: 385 },
            { x: 195, y: 290 },
          ]),
          route('route-b', 'bravo', 'obj-b', '11', '0', [
            { x: 610, y: 385 },
            { x: 415, y: 330 },
            { x: 415, y: 270 },
          ]),
          route('route-c', 'charlie', 'obj-c', '9', '2', [
            { x: 680, y: 350 },
            { x: 615, y: 290 },
          ]),
          route('route-d', 'delta', 'obj-a', '10', '1', [
            { x: 120, y: 350 },
            { x: 195, y: 330 },
            { x: 195, y: 270 },
          ]),
        ],
  };
}
function validPoint(p: Point) {
  return (
    p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= 20 &&
    p.x <= 780 &&
    p.y >= 30 &&
    p.y <= 475
  );
}
function shortText(value: unknown, max: number) {
  return typeof value === 'string' && value.length <= max;
}
export function validatePlan(p: Plan): Plan {
  if (
    !p ||
    p.map !== 'relay-station-v1' ||
    !Number.isInteger(p.revision) ||
    p.revision < 0 ||
    !p.settings ||
    p.settings.id !== 'settings' ||
    !shortText(p.settings.title, 100) ||
    !p.settings.title.trim() ||
    !shortText(p.settings.notes, 2000) ||
    !Array.isArray(p.markers) ||
    p.markers.length > 24 ||
    !Array.isArray(p.routes) ||
    p.routes.length > 24
  )
    throw new PlanningError('A board needs a title and at most 24 markers and 24 routes.');
  milliseconds(p.settings.tolerance);
  milliseconds(p.settings.deadline);
  const objects = [p.settings, ...p.markers, ...p.routes];
  if (
    objects.some(
      (o) =>
        !o ||
        typeof o.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(o.id) ||
        !Number.isInteger(o.revision) ||
        o.revision < 0,
    ) ||
    new Set(objects.map((o) => o.id)).size !== objects.length
  )
    throw new PlanningError('Every board object needs a unique identifier and revision.');
  if (
    p.markers.some(
      (m) =>
        !validPoint(m) ||
        !['player', 'objective'].includes(m.kind) ||
        !shortText(m.label, 50) ||
        !m.label.trim() ||
        !Number.isInteger(m.stage) ||
        m.stage < 1 ||
        m.stage > 4,
    )
  )
    throw new PlanningError('Keep named markers on the map and objectives in stages 1–4.');
  for (const r of p.routes) {
    const from = p.markers.find((m) => m.id === r.from),
      to = p.markers.find((m) => m.id === r.to);
    if (
      !shortText(r.label, 70) ||
      !r.label.trim() ||
      !shortText(r.owner, 40) ||
      (r.needsMeasurement !== undefined && typeof r.needsMeasurement !== 'boolean') ||
      !from ||
      !to ||
      to.kind !== 'objective' ||
      r.from === r.to ||
      !Array.isArray(r.via) ||
      r.via.length > 8 ||
      r.via.some((v) => !validPoint(v)) ||
      !Array.isArray(r.after) ||
      r.after.length > 12 ||
      new Set(r.after).size !== r.after.length
    )
      throw new PlanningError(
        'Each route needs a start, a different objective, and up to eight waypoints.',
      );
    milliseconds(r.travel);
    milliseconds(r.setup);
    milliseconds(r.delay);
    for (const id of r.after) {
      const previous = p.routes.find((candidate) => candidate.id === id);
      const previousGoal = p.markers.find((m) => m.id === previous?.to);
      if (!previous || !previousGoal || previousGoal.stage >= to.stage)
        throw new PlanningError('Prerequisite routes must finish in an earlier stage.');
    }
  }
  return p;
}
export function editPlan(plan: Plan, input: Record<string, unknown>, author: string): Plan {
  const kind = input.kind;
  if (!['marker', 'route', 'settings'].includes(kind as string))
    throw new PlanningError('Choose a marker, route, or board settings.');
  const next = structuredClone(plan);
  const list: PlanObject[] =
    kind === 'marker' ? next.markers : kind === 'route' ? next.routes : [next.settings];
  const old = list.find((o) => o.id === input.id);
  if ((old ? old.revision : null) !== input.revision)
    throw new PlanningError(
      'A teammate changed this object. Your draft is still here; load their version before editing again.',
      409,
    );
  if (input.remove) {
    if (!old || kind === 'settings')
      throw new PlanningError('Choose an existing marker or route to remove.');
    if (kind === 'marker') next.markers = next.markers.filter((m) => m.id !== input.id);
    else next.routes = next.routes.filter((r) => r.id !== input.id);
  } else {
    const obj = input.object as PlanObject;
    if (!obj || typeof obj !== 'object' || obj.id !== input.id)
      throw new PlanningError('The object could not be read.');
    const value = { ...obj, revision: old ? old.revision + 1 : 0 };
    if (kind === 'settings') next.settings = value as PlanSettings;
    else if (old) list.splice(list.indexOf(old), 1, value);
    else list.push(value);
  }
  next.revision++;
  next.updatedBy = author;
  if (kind === 'marker' && old && !input.remove) {
    const before = old as PlanMarker,
      after = next.markers.find((m) => m.id === old.id)!;
    if (before.x !== after.x || before.y !== after.y) {
      next.routes = next.routes.map((r) =>
        r.from === old.id || r.to === old.id
          ? { ...r, revision: r.revision + 1, needsMeasurement: true }
          : r,
      );
    }
  }
  if (kind === 'route' && !input.remove) {
    const current = next.routes.find((r) => r.id === input.id)!;
    const before = old as PlanRoute | undefined;
    if (
      !before ||
      before.from !== current.from ||
      before.to !== current.to ||
      JSON.stringify(before.via) !== JSON.stringify(current.via)
    )
      current.needsMeasurement = true;
  }
  return validatePlan(next);
}
export function schedule(plan: Plan) {
  const results: {
    route: PlanRoute;
    stage: number;
    base: number;
    start: number;
    ready: number;
    offset: number;
  }[] = [];
  const ordered = [...plan.routes].sort(
    (a, b) =>
      plan.markers.find((m) => m.id === a.to)!.stage -
      plan.markers.find((m) => m.id === b.to)!.stage,
  );
  for (const route of ordered) {
    const base = Math.max(
      0,
      ...route.after.map((id) => results.find((r) => r.route.id === id)!.ready),
    );
    const offset = base + milliseconds(route.travel) + milliseconds(route.setup);
    const start = base + milliseconds(route.delay);
    results.push({
      route,
      stage: plan.markers.find((m) => m.id === route.to)!.stage,
      base,
      start,
      ready: offset + milliseconds(route.delay),
      offset,
    });
  }
  const stages = [...new Set(results.map((r) => r.stage))].map((stage) => {
    const group = results.filter((r) => r.stage === stage);
    const spread = Math.max(...group.map((r) => r.ready)) - Math.min(...group.map((r) => r.ready));
    return { stage, spread, fits: spread <= milliseconds(plan.settings.tolerance) };
  });
  const finish = Math.max(0, ...results.map((r) => r.ready));
  const unassigned = plan.markers.filter(
    (m) => m.kind === 'objective' && !plan.routes.some((r) => r.to === m.id),
  );
  return {
    results,
    stages,
    finish,
    unassigned,
    unmeasured: plan.routes.filter((r) => r.needsMeasurement),
    meetsDeadline: finish <= milliseconds(plan.settings.deadline),
    feasible:
      results.length > 0 &&
      !plan.routes.some((r) => r.needsMeasurement) &&
      unassigned.length === 0 &&
      stages.every((s) => s.fits) &&
      finish <= milliseconds(plan.settings.deadline),
  };
}
export function timingQuestion(plan: Plan, routeId: string) {
  const timeline = schedule(plan);
  const item = timeline.results.find((r) => r.route.id === routeId);
  if (!item) return null;
  const peers = timeline.results.filter((r) => r.stage === item.stage && r.route.id !== routeId);
  const offset = seconds(item.offset);
  const constraints = [
    's >= 0',
    `s + ${offset} <= ${plan.settings.deadline}`,
    ...peers.map((r) => `|s + ${offset} - ${seconds(r.ready)}| <= ${plan.settings.tolerance}`),
  ];
  return {
    equation: constraints[2] || constraints[1],
    constraints: peers.length
      ? [
          constraints[0],
          constraints[1],
          ...constraints.slice(3),
          `${seconds(Math.max(...peers.map((r) => r.ready)) - Math.min(...peers.map((r) => r.ready)))} <= ${plan.settings.tolerance}`,
          `${seconds(Math.max(...peers.map((r) => r.ready)))} <= ${plan.settings.deadline}`,
        ]
      : [constraints[0]],
    offset,
    base: seconds(item.base),
  };
}
