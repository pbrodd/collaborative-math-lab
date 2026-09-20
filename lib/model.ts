import { scenarioCatalog } from '../scenarios/catalog';
import { analyze, equivalent, numberValue } from './algebra';
import { assessment, type Task, type Work } from './missions';
export type Cell = {
  id: string;
  type: 'idea' | 'question' | 'calculation' | 'graph';
  text: string;
  expression: string;
  min?: number;
  max?: number;
};
export type ScenarioTask = Task & {
  output: string;
  dependencies: string[];
  intended: string;
  constraints: string[];
  intent: 'unique' | 'multiple' | 'none' | 'open';
  answerExpressions?: Record<string, string>;
};
export type Scenario = {
  type: 'scenario';
  story: string;
  theme: 'brawl' | 'siege' | 'original';
  information: string;
  data: { key: string; value: string; unit: string }[];
  tasks: ScenarioTask[];
};
export type Notebook = { type: 'notebook'; cells: Cell[] };
export type Document = Scenario | Notebook;
export type Member = { id: string; name: string; last_seen: number };
export type Contribution = {
  task_id: string;
  owner_id: string | null;
  work: Work;
  revision: number;
  book_revision: number;
  published: number;
  reviewer_id: string | null;
  updated_at: number;
};
export type Attribution = { id: string; title: string; creator: string };
export type Review = {
  id: string;
  task_id: string;
  member_id: string;
  work_revision: number;
  verdict: 'approve' | 'changes' | 'reply';
  note: string;
  created_at: number;
};
export type Book = {
  id: string;
  code: string;
  kind: 'notebook' | 'scenario' | 'play';
  title: string;
  creator: string;
  source: Attribution | null;
  document: Document;
  revision: number;
  created_at: number;
  updated_at: number;
  isOwner: boolean;
  me: string;
  members: Member[];
  contributions: Contribution[];
  reviews: Review[];
};
export type Summary = Pick<Book, 'id' | 'kind' | 'title' | 'creator' | 'updated_at'> & {
  members: number;
};
export function blankTask(index = 1): ScenarioTask {
  return {
    id: crypto.randomUUID(),
    role: `Role ${index}`,
    title: 'A question worth exploring',
    intro: '',
    equation: '',
    variable: 'x',
    unit: '',
    hints: ['', '', ''],
    answers: [],
    takeaway: '',
    kind: 'role',
    facts: [],
    output: `result_${index}`,
    dependencies: [],
    intended: '',
    constraints: [],
    intent: 'open',
  };
}
export function blankScenario(): Scenario {
  return {
    type: 'scenario',
    theme: 'original',
    story: '',
    information: '',
    data: [],
    tasks: [blankTask()],
  };
}
export function starterScenario(theme: string): Scenario {
  return structuredClone(scenarioCatalog.find((s) => s.id === theme)!.scenario) as Scenario;
}
export function outputExpression(equation: string, variable: string): string | null {
  const parts = equation.trim().split('=');
  if (parts.length !== 2 || /\bor\b/i.test(equation)) return null;
  if (parts[0].trim() === variable) return parts[1].trim();
  if (parts[1].trim() === variable) return parts[0].trim();
  return null;
}
export function substitute(text: string, values: Record<string, string>) {
  return text.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g, (all, key) =>
    values[key] !== undefined ? `(${values[key]})` : all,
  );
}
export function scenarioValues(
  scenario: Scenario,
  contributions: Contribution[] = [],
  author = false,
  revision = 0,
) {
  const values: Record<string, string> = Object.create(null);
  for (const d of scenario.data) values[d.key] = d.value;
  for (let pass = 0; pass < scenario.tasks.length; pass++) {
    let changed = false;
    for (const task of scenario.tasks) {
      if (!task.output || values[task.output] !== undefined) continue;
      const work = contributions.find(
        (c) => c.task_id === task.id && c.published && c.book_revision === revision,
      );
      const result = author ? task.intended : work?.work.steps.at(-1)?.equation;
      if (result) {
        const output = outputExpression(result, task.variable);
        if (output !== null) {
          const value = substitute(output, values);
          if (!value.includes('{{')) {
            values[task.output] = value;
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
  return values;
}
function expectedNumber(s: string): number {
  const ceil = s.match(/^ceil\((.*)\)$/);
  if (ceil) return Math.ceil(numberValue(ceil[1]));
  const min = s.match(/^min\((.*),(.*)\)$/);
  if (min) return Math.min(numberValue(min[1]), numberValue(min[2]));
  return numberValue(s);
}
export function resolveTask(task: ScenarioTask, values: Record<string, string>): ScenarioTask {
  const answers = task.answers.map((a) => {
    try {
      return {
        ...a,
        expected: task.answerExpressions?.[a.key]
          ? expectedNumber(substitute(task.answerExpressions[a.key], values))
          : a.expected,
      };
    } catch {
      return { ...a, expected: NaN };
    }
  });
  return {
    ...task,
    equation: substitute(task.equation, values),
    intro: substitute(task.intro, values),
    intended: substitute(task.intended, values),
    constraints: task.constraints.filter((c) => c.trim()).map((c) => substitute(c, values)),
    hints: task.hints.map((h) => substitute(h, values)),
    answers,
  };
}
export function assessTask(task: ScenarioTask, work: Work) {
  if (!task.equation.trim())
    return {
      checked: work.explanation.trim().length >= 12,
      message: 'Record your observations and reasoning to publish this open investigation.',
      checks: [],
      isolated: true,
      answers: true,
      explained: work.explanation.trim().length >= 12,
    };
  const standard = assessment(task, work);
  if (
    task.intent === 'none' ||
    task.constraints.length ||
    task.equation.includes('<') ||
    task.equation.includes('>')
  ) {
    const original = analyze(task.equation, task.constraints);
    const final = work.steps.at(-1)?.equation || '';
    const solved = analyze(final);
    const same = original.kind !== 'unsupported' && original.description === solved.description;
    return {
      ...standard,
      checked: same && standard.explained && standard.answers,
      message: same
        ? standard.explained
          ? 'Ready to publish.'
          : 'Explain what the solution region means.'
        : 'Check that your final line satisfies all of the constraints.',
      isolated: same,
    };
  }
  return standard;
}
export function auditScenario(s: Scenario) {
  const values = scenarioValues(s, [], true);
  return s.tasks.map((task) => {
    const resolved = resolveTask(task, values);
    const result = analyze(resolved.equation, resolved.constraints);
    const intended = resolved.intended ? equivalent(resolved.equation, resolved.intended) : null;
    return {
      id: task.id,
      title: task.title,
      ...result,
      intended: resolved.constraints.length ? null : intended,
    };
  });
}
