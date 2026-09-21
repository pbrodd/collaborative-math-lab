import type { Document } from './model';
export class ValidationError extends Error {}
export function validateDocument(value: unknown): Document {
  if (!value || typeof value !== 'object') throw new ValidationError('A document is required.');
  const d = value as Document;
  if (d.appearance !== undefined && !['paper', 'briefing'].includes(d.appearance))
    throw new ValidationError('Choose the paper or mission briefing appearance.');
  if (d.type === 'notebook') {
    if (
      !Array.isArray(d.cells) ||
      d.cells.length > 80 ||
      d.cells.some(
        (c) =>
          typeof c.id !== 'string' ||
          !['idea', 'question', 'calculation', 'graph'].includes(c.type) ||
          typeof c.text !== 'string' ||
          c.text.length > 10000 ||
          typeof c.expression !== 'string' ||
          c.expression.length > 240,
      )
    )
      throw new ValidationError('Use up to 80 notebook cells with short expressions.');
    if (new Set(d.cells.map((c) => c.id)).size !== d.cells.length)
      throw new ValidationError('Each notebook cell needs a unique identifier.');
    return d;
  }
  if (
    d.type !== 'scenario' ||
    !['original', 'brawl', 'siege'].includes(d.theme) ||
    typeof d.story !== 'string' ||
    d.story.length > 10000 ||
    typeof d.information !== 'string' ||
    d.information.length > 10000 ||
    !Array.isArray(d.data) ||
    d.data.length > 40 ||
    !Array.isArray(d.tasks) ||
    d.tasks.length < 1 ||
    d.tasks.length > 16
  )
    throw new ValidationError('A scenario needs a story and 1–16 tasks.');
  if (
    d.data.some(
      (item) =>
        !item ||
        !/^[_a-zA-Z][_a-zA-Z0-9]{0,40}$/.test(item.key) ||
        typeof item.value !== 'string' ||
        item.value.length > 100 ||
        typeof item.unit !== 'string' ||
        item.unit.length > 100,
    )
  )
    throw new ValidationError('Give each data item a short key, value, and unit.');
  const ids = new Set(d.tasks.map((t) => t.id));
  if (ids.size !== d.tasks.length) throw new ValidationError('Task identifiers must be unique.');
  for (const t of d.tasks) {
    if (
      typeof t.id !== 'string' ||
      t.id.length > 100 ||
      typeof t.title !== 'string' ||
      t.title.length > 200 ||
      typeof t.role !== 'string' ||
      t.role.length > 100 ||
      typeof t.intro !== 'string' ||
      t.intro.length > 5000 ||
      typeof t.equation !== 'string' ||
      t.equation.length > 240 ||
      !/^([a-z])$/.test(t.variable) ||
      typeof t.unit !== 'string' ||
      !Array.isArray(t.hints) ||
      t.hints.length > 5 ||
      t.hints.some((h) => typeof h !== 'string' || h.length > 1000) ||
      !Array.isArray(t.dependencies) ||
      t.dependencies.some((id) => !ids.has(id) || id === t.id) ||
      typeof t.output !== 'string' ||
      (t.output && !/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(t.output)) ||
      typeof t.intended !== 'string' ||
      t.intended.length > 240 ||
      !Array.isArray(t.constraints) ||
      t.constraints.length > 10 ||
      t.constraints.some((c) => typeof c !== 'string' || c.length > 240) ||
      !['unique', 'multiple', 'none', 'open'].includes(t.intent) ||
      !['role', 'team', 'transfer'].includes(t.kind) ||
      !Array.isArray(t.answers) ||
      t.answers.length > 5 ||
      t.answers.some(
        (a) =>
          typeof a.key !== 'string' ||
          typeof a.label !== 'string' ||
          typeof a.unit !== 'string' ||
          typeof a.expected !== 'number' ||
          !Number.isFinite(a.expected),
      )
    )
      throw new ValidationError(
        'Check the role, question, equation, hints, output, and dependencies for each task.',
      );
  }
  const outputs = [...d.data.map((v) => v.key), ...d.tasks.map((t) => t.output).filter(Boolean)];
  if (new Set(outputs).size !== outputs.length)
    throw new ValidationError('Data keys and output names must be unique.');
  for (const task of d.tasks) {
    const text = [
      task.equation,
      task.intro,
      ...task.constraints,
      ...Object.values(task.answerExpressions || {}),
    ].join(' ');
    for (const reference of text.matchAll(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g)) {
      if (!outputs.includes(reference[1]))
        throw new ValidationError(`The input ${reference[1]} has no data item or role output.`);
      const upstream = d.tasks.find((t) => t.output === reference[1]);
      if (upstream && !task.dependencies.includes(upstream.id))
        throw new ValidationError(
          `Connect ${task.role} to ${upstream.role} before using its output.`,
        );
    }
  }
  const visit = (id: string, path: Set<string>) => {
    if (path.has(id))
      throw new ValidationError(
        'Role dependencies form a loop. Connect them in an order the team can solve.',
      );
    const next = new Set(path).add(id);
    d.tasks.find((t) => t.id === id)?.dependencies.forEach((k) => visit(k, next));
  };
  d.tasks.forEach((t) => visit(t.id, new Set()));
  return d;
}
