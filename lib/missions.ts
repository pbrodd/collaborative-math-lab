import { equivalent, isIsolated, numberValue } from './algebra';
export type MissionId = 'brawl' | 'siege';
export type HelpMode = 'build' | 'guide' | 'notebook';
export type Parameters = { health: number; arrival: number; deadline: number };
export const defaults: Parameters = { health: 6000, arrival: 20, deadline: 21 };
export type Step = { equation: string; reason: string };
export type MathEntry = { latex: string; reason: string; amount: string; operation: string };
export const emptyEntry = (): MathEntry => ({
  latex: '',
  reason: '',
  amount: '',
  operation: 'subtract',
});
export type Work = {
  steps: Step[];
  answers: Record<string, string>;
  explanation: string;
  hints: number;
  mode: HelpMode;
  entry?: MathEntry;
};
export const emptyWork = (): Work => ({
  steps: [],
  answers: {},
  explanation: '',
  hints: 0,
  mode: 'build',
});
export type AnswerField = { key: string; label: string; unit: string; expected: number };
export type Task = {
  id: string;
  role: string;
  title: string;
  intro: string;
  equation: string;
  variable: string;
  unit: string;
  hints: string[];
  answers: AnswerField[];
  takeaway: string;
  kind: 'role' | 'team' | 'transfer';
  facts: { label: string; value: string }[];
};
export const missions = {
  brawl: {
    name: 'Brawl Stars',
    title: 'The three-hit question',
    subtitle: 'When does a small upgrade make a big difference?',
    category: 'MATCHUP LAB',
    description:
      'Investigate health, decode a shield, and find the upgrade that changes a matchup.',
    skills: ['Variable isolation', 'Literal formulas', 'Thresholds'],
    color: 'brawl',
    minutes: '20–30 min',
    icon: '✦',
  },
  siege: {
    name: 'Rainbow Six Siege',
    title: 'Every second counts',
    subtitle: 'Three teammates. Two routes. One window.',
    category: 'TIMING LAB',
    description:
      'Measure the routes, coordinate arrivals, and find a plan that beats the deadline.',
    skills: ['Linear equations', 'Absolute value', 'Constraints'],
    color: 'siege',
    minutes: '20–30 min',
    icon: '⌁',
  },
} as const;
export function tasksFor(mission: MissionId, p: Parameters): Task[] {
  const common = { kind: 'role' as const, answers: [] as AnswerField[] };
  if (mission === 'brawl')
    return [
      {
        ...common,
        id: 'health',
        role: 'Health analyst',
        title: 'Reconstruct the health bar',
        intro: `In our controlled simulation, two hits each deal 1,800 damage. The target has ${p.health - 3600} health remaining. Find its starting health h.`,
        equation: `h - 2(1800) = ${p.health - 3600}`,
        variable: 'h',
        unit: 'HP',
        facts: [
          { label: 'Damage per hit', value: '1,800 HP' },
          { label: 'Hits landed', value: '2' },
        ],
        hints: [
          'The target started with more health than it has now. How much has it lost?',
          'Combine the two hits: 2 × 1,800 = 3,600. Undo subtracting that amount.',
          'Add 3,600 to both sides. The isolated h gives the original health.',
        ],
        takeaway: 'An equation lets you reconstruct a quantity you could not observe directly.',
      },
      {
        ...common,
        id: 'shield',
        role: 'Shield analyst',
        title: 'Find what the shield removes',
        intro:
          'A 1,500-damage hit deals only 1,200 damage through the shield. Let r be the fraction of damage removed. Isolate r and explain what it means.',
        equation: '1500(1 - r) = 1200',
        variable: 'r',
        unit: 'fraction',
        facts: [
          { label: 'Raw damage', value: '1,500 HP' },
          { label: 'Actual damage', value: '1,200 HP' },
        ],
        hints: [
          'The quantity 1 − r is the fraction of damage that gets through.',
          'Divide both sides by 1,500, or distribute first. Either approach works.',
          'After dividing: 1 − r = 4/5. Subtract 1, then divide by −1.',
        ],
        takeaway: 'A reduction of 1/5 means 20% is removed and 80% gets through.',
      },
      {
        ...common,
        id: 'upgrades',
        role: 'Upgrade analyst',
        title: 'Turn the formula around',
        intro:
          'Our practice upgrade system starts at 1,800 raw damage and adds 200 per upgrade. Rearrange the formula to make upgrades u the subject, in terms of desired damage d.',
        equation: 'd = 1800 + 200u',
        variable: 'u',
        unit: 'upgrades',
        facts: [
          { label: 'Starting damage', value: '1,800 HP' },
          { label: 'Per upgrade', value: '+200 HP' },
        ],
        hints: [
          'Keep d as a variable. You are building a reusable formula.',
          'Subtract 1,800 from both sides to isolate the term 200u.',
          'Divide the entire remaining expression by 200. Parentheses matter.',
        ],
        takeaway: 'The same relationship can answer “how much damage?” or “how many upgrades?”',
      },
      {
        id: 'combine',
        role: 'Team planning table',
        title: 'Find the upgrade that matters',
        intro: `Combine your findings. Three hits must cover ${p.health} health after the shield. Find the raw damage d at that boundary, then use the upgrade formula. Only whole upgrades can be bought.`,
        equation: `3(0.8d) = ${p.health}`,
        variable: 'd',
        unit: 'HP per hit',
        kind: 'team',
        facts: [
          { label: 'Hits available', value: '3' },
          { label: 'Damage gets through', value: '80%' },
        ],
        answers: [
          {
            key: 'upgrades',
            label: 'Minimum whole upgrades',
            unit: 'upgrades',
            expected: Math.max(0, Math.ceil((p.health / 2.4 - 1800) / 200)),
          },
        ],
        hints: [
          'Use the health and shield results to find raw damage first.',
          'Three hits deliver 3 × 0.8 × d damage. Divide the health by 2.4.',
          'Put that damage into u = (d − 1800)/200. If it is fractional, test the next whole upgrade and the one below.',
        ],
        takeaway: 'A threshold can make one small upgrade change the number of hits needed.',
      },
      {
        id: 'transfer',
        role: 'Your independent check',
        title: 'Take the idea with you',
        intro:
          'A new relationship, without the game data: solve for x. Explain one operation you used. Your work is saved separately from your teammates’ checks.',
        equation: '4(x - 3) = 2x + 10',
        variable: 'x',
        unit: '',
        kind: 'transfer',
        facts: [],
        answers: [],
        hints: [
          'There are x terms on both sides. Preserve equality as you collect them.',
          'Distribute 4 to both terms inside the parentheses.',
          'Subtract 2x from both sides, add 12, then divide by 2.',
        ],
        takeaway: 'You can carry the same algebraic moves into a new situation.',
      },
    ];
  return [
    {
      ...common,
      id: 'route',
      role: 'Route analyst',
      title: 'Measure your travel time',
      intro:
        'Four rehearsal runs take 32 seconds total. Each run includes the route plus a 2-second reset. Solve for the route time t, excluding the reset.',
      equation: '4(t + 2) = 32',
      variable: 't',
      unit: 'seconds',
      facts: [
        { label: 'Rehearsal runs', value: '4' },
        { label: 'Reset per run', value: '2 sec' },
      ],
      hints: [
        'The parentheses describe one rehearsal: travel plus reset.',
        'Divide both sides by 4 to get the time for one rehearsal.',
        'Subtract the 2-second reset from both sides.',
      ],
      takeaway: 'Grouping keeps repeated overhead attached to each run.',
    },
    {
      ...common,
      id: 'arrival',
      role: 'Teammate analyst',
      title: 'Predict your teammate’s arrival',
      intro: `Three identical teammate runs plus one 6-second setup took ${3 * p.arrival + 6} seconds. Find the time a for one run. The teammate starts at the shared countdown’s zero.`,
      equation: `3a + 6 = ${3 * p.arrival + 6}`,
      variable: 'a',
      unit: 'seconds',
      facts: [
        { label: 'Identical runs', value: '3' },
        { label: 'One-time setup', value: '6 sec' },
      ],
      hints: [
        'Remove the one-time setup before dividing among the runs.',
        'Subtract 6 from both sides.',
        'Divide by 3. That run time is the teammate’s arrival time from the shared zero.',
      ],
      takeaway: 'One-time overhead and per-run overhead produce different equations.',
    },
    {
      ...common,
      id: 'deadline',
      role: 'Objective analyst',
      title: 'Recover the deadline',
      intro: `The scenario designer recorded two equal arrival budgets plus an 8-second reset, totaling ${2 * p.deadline + 8} seconds. Find one budget b: the latest arrival the simulation allows.`,
      equation: `2b + 8 = ${2 * p.deadline + 8}`,
      variable: 'b',
      unit: 'seconds',
      facts: [
        { label: 'Equal budgets', value: '2' },
        { label: 'Reset', value: '8 sec' },
      ],
      hints: [
        'The total contains two budgets and one reset.',
        'Subtract 8 to remove the reset.',
        'Divide the remaining time by 2 to find b.',
      ],
      takeaway: 'A deadline becomes a constraint on the plan, not just a number.',
    },
    {
      id: 'combine',
      role: 'Team planning table',
      title: 'Find every workable start time',
      intro: `Your route takes 6 seconds. Your teammate arrives at ${p.arrival} seconds. First solve for starts s that put you exactly 2 seconds apart. Then find the full start window within 2 seconds, with arrival no later than ${p.deadline} seconds.`,
      equation: `|s + 6 - ${p.arrival}| = 2`,
      variable: 's',
      unit: 'seconds',
      kind: 'team',
      facts: [
        { label: 'Arrival tolerance', value: '±2 sec' },
        { label: 'Route duration', value: '6 sec' },
      ],
      answers: [
        { key: 'earliest', label: 'Earliest allowed start', unit: 'sec', expected: p.arrival - 8 },
        {
          key: 'latest',
          label: 'Latest allowed start',
          unit: 'sec',
          expected: Math.min(p.arrival - 4, p.deadline - 6),
        },
      ],
      hints: [
        'Absolute value is the distance between the two arrival times. Two starts can be exactly 2 seconds apart.',
        'After simplifying, open both paths: s − (a − 6) = 2 or s − (a − 6) = −2. Solve both.',
        'The endpoints give a whole interval for “within.” Also require s + 6 ≤ b. The deadline may shorten the interval.',
      ],
      takeaway:
        '“Exactly” gives boundary points. “Within” gives an interval. Every constraint must hold.',
    },
    {
      id: 'transfer',
      role: 'Your independent check',
      title: 'Two paths, a fresh equation',
      intro:
        'Solve this new equation for every value of x. Isolate the absolute-value expression before opening its paths. Your check is saved separately.',
      equation: '3|x - 4| + 2 = 11',
      variable: 'x',
      unit: '',
      kind: 'transfer',
      facts: [],
      answers: [],
      hints: [
        'Undo the operations outside the absolute-value bars first.',
        'Subtract 2, then divide both sides by 3.',
        'Now |x − 4| = 3. Open the +3 and −3 paths and add 4 to each.',
      ],
      takeaway: 'Keeping both paths preserves the full solution set.',
    },
  ];
}
export function assessment(task: Task, work: Work) {
  let previous = task.equation;
  const checks = work.steps.map((s) => {
    const check = equivalent(previous, s.equation);
    previous = s.equation;
    return check;
  });
  const last = work.steps.at(-1)?.equation || '';
  const isolated =
    !!last && isIsolated(last, task.variable) && equivalent(task.equation, last).valid;
  const answers = task.answers.every((f) => {
    try {
      return Math.abs(numberValue(work.answers[f.key] || '') - f.expected) < 1e-9;
    } catch {
      return false;
    }
  });
  const explained = work.explanation.trim().length >= 12;
  const checked =
    checks.length > 0 && checks.every((c) => c.valid) && isolated && answers && explained;
  let message = 'Ready to publish your reasoning.';
  if (!work.steps.length) message = 'Show at least one algebraic step before publishing.';
  else if (checks.some((c) => !c.valid))
    message = 'Revisit the highlighted step before publishing.';
  else if (!isolated) message = `Keep going until ${task.variable} is isolated in every path.`;
  else if (!answers)
    message = 'Check the final decision fields against all of the mission constraints.';
  else if (!explained) message = 'Add a short explanation of what your result means.';
  return { checked, message, checks, isolated, answers, explained };
}
