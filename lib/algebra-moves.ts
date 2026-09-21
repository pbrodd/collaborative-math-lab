import { clean, constantValue, equivalent, rational as r, type Q } from './algebra.ts';
import { parseExpression, written, type Expression } from './math-notation.ts';

export type Move = 'add' | 'subtract' | 'multiply' | 'divide' | 'combine' | 'distribute' | 'split';
export type Target = { clause: number; side: 'left' | 'right'; term: number };
export type MovePreview = {
  before: string;
  working: string;
  after: string;
  reason: string;
  flips: boolean;
};
const binary = (op: string, left: Expression, right: Expression): Expression => ({
  kind: 'binary',
  op,
  left,
  right,
});
const negative = (child: Expression): Expression => ({ kind: 'negative', child });
const group = (child: Expression): Expression => ({ kind: 'group', child });
const number = (value: Q): Expression => {
  const magnitude: Expression = {
    kind: 'number',
    value: String(value.n < 0n ? -value.n : value.n),
  };
  const n = value.n < 0n ? negative(magnitude) : magnitude;
  return value.d === 1n ? n : binary('/', n, { kind: 'number', value: String(value.d) });
};
function numeric(node: Expression): Q | null {
  try {
    return constantValue(written(node));
  } catch {
    return null;
  }
}
function factors(node: Expression): { coefficient: Q; bases: Expression[] } {
  const value = numeric(node);
  if (value) return { coefficient: value, bases: [] };
  if (
    node.kind === 'group' &&
    !(node.child.kind === 'binary' && ['+', '-'].includes(node.child.op))
  )
    return factors(node.child);
  if (node.kind === 'negative') {
    const item = factors(node.child);
    return { ...item, coefficient: r.negate(item.coefficient) };
  }
  if (node.kind === 'binary' && node.op === '*') {
    const a = factors(node.left),
      b = factors(node.right);
    return {
      coefficient: r.multiply(a.coefficient, b.coefficient),
      bases: [...a.bases, ...b.bases],
    };
  }
  if (node.kind === 'binary' && node.op === '/') {
    const denominator = numeric(node.right);
    if (!denominator) throw new Error('Divide by a constant number to preserve the solutions.');
    const a = factors(node.left);
    return { ...a, coefficient: r.divide(a.coefficient, denominator) };
  }
  return { coefficient: r.of(1), bases: [node] };
}
function product(coefficient: Q, bases: Expression[]): Expression {
  if (!coefficient.n || !bases.length) return number(coefficient);
  const body = bases.reduce((a, b) => binary('*', a, b));
  if (coefficient.n === coefficient.d) return body;
  if (coefficient.n === -coefficient.d) return negative(body);
  const numerator =
    coefficient.n === 1n
      ? body
      : coefficient.n === -1n
        ? negative(body)
        : binary('*', number(r.of(coefficient.n)), body);
  return coefficient.d === 1n ? numerator : binary('/', numerator, number(r.of(coefficient.d)));
}
export function terms(node: Expression): Expression[] {
  if (node.kind === 'binary' && node.op === '+') return [...terms(node.left), ...terms(node.right)];
  if (node.kind === 'binary' && node.op === '-')
    return [...terms(node.left), ...terms(node.right).map(negative)];
  return [node];
}
function sum(items: Expression[]): Expression {
  if (!items.length) return number(r.of(0));
  return items
    .slice(1)
    .reduce(
      (a, b) => (b.kind === 'negative' ? binary('-', a, b.child) : binary('+', a, b)),
      items[0],
    );
}
// Cancel/collect terms while keeping groups intact and retaining their order.
// Expanding a group is a separate, named student action.
function reduce(node: Expression): Expression {
  const value = numeric(node);
  if (value) return number(value);
  if (node.kind === 'group' || node.kind === 'absolute')
    return { ...node, child: reduce(node.child) };
  if (node.kind === 'negative') {
    const child = reduce(node.child);
    return child.kind === 'negative' ? child.child : negative(child);
  }
  if (node.kind !== 'binary') return node;
  const updated = binary(node.op, reduce(node.left), reduce(node.right));
  if (node.op === '*' || node.op === '/') {
    const { coefficient, bases } = factors(updated);
    return product(coefficient, bases);
  }
  const grouped = new Map<string, { coefficient: Q; bases: Expression[] }>();
  for (const term of terms(updated)) {
    const item = factors(term),
      key = item.bases.map(written).join('*');
    const previous = grouped.get(key);
    grouped.set(key, {
      ...item,
      coefficient: previous ? r.add(previous.coefficient, item.coefficient) : item.coefficient,
    });
  }
  return sum(
    [...grouped.values()]
      .filter((item) => item.coefficient.n)
      .map((item) => {
        return item.coefficient.n < 0n
          ? negative(product(r.negate(item.coefficient), item.bases))
          : product(item.coefficient, item.bases);
      }),
  );
}
function ungroup(node: Expression): Expression {
  return node.kind === 'group' ? ungroup(node.child) : node;
}
function expand(node: Expression): Expression {
  if (node.kind === 'group') return expand(node.child);
  if (node.kind === 'absolute') return { ...node, child: expand(node.child) };
  if (node.kind === 'negative') {
    const child = expand(node.child);
    return child.kind === 'binary' && ['+', '-'].includes(child.op)
      ? binary(child.op, expand(negative(child.left)), expand(negative(child.right)))
      : negative(child);
  }
  if (node.kind !== 'binary') return node;
  const left = expand(node.left),
    right = expand(node.right);
  if (node.op === '*' || node.op === '/') {
    if (left.kind === 'binary' && ['+', '-'].includes(left.op))
      return binary(
        left.op,
        expand(binary(node.op, left.left, right)),
        expand(binary(node.op, left.right, right)),
      );
    if (node.op === '*' && right.kind === 'binary' && ['+', '-'].includes(right.op))
      return binary(
        right.op,
        expand(binary('*', left, right.left)),
        expand(binary('*', left, right.right)),
      );
  }
  return binary(node.op, left, right);
}
export function branches(equation: string): string[] {
  return clean(equation).split(/\s+or\s+/);
}
export function relations(branch: string) {
  return branch.split(/\s+and\s+/).flatMap((part) => {
    const p = part.split(/(<=|>=|=|<|>)/);
    if (p.length < 3 || p.length % 2 !== 1)
      throw new Error('Write both sides of an equation or inequality.');
    return Array.from({ length: (p.length - 1) / 2 }, (_, i) => ({
      left: parseExpression(p[i * 2]),
      op: p[i * 2 + 1],
      right: parseExpression(p[i * 2 + 2]),
    }));
  });
}
export function choices(node: Expression): { label: string; operation: Move; amount: string }[] {
  const text = written(node),
    { coefficient, bases } = factors(node);
  const result: { label: string; operation: Move; amount: string }[] = [
    { label: `Subtract ${text} from both sides`, operation: 'subtract', amount: text },
  ];
  if (coefficient.n < 0n)
    result[0] = {
      label: `Add ${written(product(r.negate(coefficient), bases))} to both sides`,
      operation: 'add',
      amount: written(product(r.negate(coefficient), bases)),
    };
  if (bases.length && coefficient.n && coefficient.n !== coefficient.d)
    result.push({
      label: `Divide both sides by ${r.format(coefficient)}`,
      operation: 'divide',
      amount: r.format(coefficient),
    });
  if (written(reduce(expand(node))) !== written(reduce(node)))
    result.push({ label: 'Distribute this term', operation: 'distribute', amount: '' });
  if (ungroup(node).kind === 'absolute')
    result.push({ label: 'Open absolute-value cases', operation: 'split', amount: '' });
  return result;
}
const reverse = (op: string) =>
  (({ '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=' }) as Record<string, string>)[op];
function splitAbsolute(branch: string): string {
  const list = relations(branch);
  if (list.length !== 1)
    throw new Error('Open the absolute-value cases before combining conditions.');
  let { left, right, op } = list[0];
  left = ungroup(left);
  right = ungroup(right);
  if (right.kind === 'absolute') {
    [left, right] = [right, left];
    op = reverse(op);
  }
  if (left.kind !== 'absolute') throw new Error('Isolate the absolute value first.');
  const value = constantValue(written(right)),
    inner = written(left.child);
  const positive = r.format(value),
    minus = r.format(r.negate(value));
  if (op === '=')
    return value.n < 0n
      ? 'no solution'
      : value.n === 0n
        ? `${inner} = 0`
        : `${inner} = ${positive} or ${inner} = ${minus}`;
  if (op === '<' || op === '<=') {
    if (value.n < 0n || (value.n === 0n && op === '<')) return 'no solution';
    if (value.n === 0n) return `${inner} = 0`;
    return `${inner} ${reverse(op)} ${minus} and ${inner} ${op} ${positive}`;
  }
  if (value.n < 0n || (value.n === 0n && op === '>=')) return 'all real numbers';
  return `${inner} ${reverse(op)} ${minus} or ${inner} ${op} ${positive}`;
}
export function previewMove(
  equation: string,
  operation: Move,
  amount = '',
  branch: number | 'all' = 'all',
  target?: Target,
): MovePreview {
  const original = equivalent(equation, equation);
  if (!original.valid) throw new Error(original.message);
  const parts = branches(equation);
  if (branch !== 'all' && (!Number.isInteger(branch) || branch < 0 || branch >= parts.length))
    throw new Error('Choose an existing case.');
  const operator = (
    { add: '+', subtract: '-', multiply: '*', divide: '/' } as Record<string, string>
  )[operation];
  let operand: Expression | undefined,
    flips = false;
  if (operator) {
    operand = parseExpression(amount);
    if (operation === 'multiply' || operation === 'divide') {
      const value = constantValue(amount);
      if (!value.n) throw new Error('Use a nonzero number to preserve every solution.');
      flips = value.n < 0n;
    } else {
      // This self-check also bounds the input to supported affine expressions.
      const check = equivalent(`${amount}=0`, `${amount}=0`);
      if (!check.valid || amount.includes('|'))
        throw new Error('Add or subtract a linear expression, such as 7 or 2x.');
    }
  }
  const workings: string[] = [];
  const results = parts.map((part, index) => {
    if (branch !== 'all' && index !== branch) {
      workings.push(part);
      return part;
    }
    if (operation === 'split') {
      const opened = splitAbsolute(part);
      workings.push(opened);
      return opened;
    }
    const working: string[] = [];
    const after = relations(part)
      .map((relation, clause) => {
        const sides = (['left', 'right'] as const).map((side) => {
          const original = relation[side];
          let changed: Expression;
          if (operand) changed = binary(operator, group(original), group(operand));
          else if (operation === 'distribute') {
            if (!target) changed = expand(original);
            else if (target.clause === clause && target.side === side) {
              const items = terms(original);
              if (!items[target.term]) throw new Error('Select the term again.');
              changed = sum(items.map((term, i) => (i === target.term ? expand(term) : term)));
            } else changed = original;
          } else if (operation === 'combine') changed = original;
          else throw new Error('Choose an operation.');
          // In addition/subtraction the whole-side parentheses are explanatory,
          // not a new group to preserve when collecting terms.
          const result =
            operand && ['add', 'subtract'].includes(operation)
              ? reduce(binary(operator, original, operand))
              : reduce(changed);
          return { working: written(changed), after: written(ungroup(result)) };
        });
        const op = flips ? reverse(relation.op) : relation.op;
        working.push(`${sides[0].working} ${op} ${sides[1].working}`);
        return `${sides[0].after} ${op} ${sides[1].after}`;
      })
      .join(' and ');
    workings.push(working.join(' and '));
    return after;
  });
  const after = results.join(' or ');
  if (after.length > 240)
    throw new Error('This move makes a long line. Work on one case or combine terms first.');
  const check = equivalent(equation, after);
  if (!check.valid) throw new Error(check.message);
  const hasInequality = /[<>]/.test(equation);
  const constantAmount = operand ? numeric(operand) : null;
  const amountLabel = constantAmount
    ? r.format(constantAmount)
    : operand
      ? written(operand)
      : amount;
  const action =
    operation === 'split'
      ? 'Opened every absolute-value case.'
      : operation === 'distribute'
        ? 'Distributed across the terms in parentheses.'
        : operation === 'combine'
          ? 'Combined like terms without changing their values.'
          : `${({ add: 'Added', subtract: 'Subtracted', multiply: 'Multiplied by', divide: 'Divided by' } as Record<string, string>)[operation]} ${amountLabel} on both sides.`;
  return {
    before: equation,
    working: workings.join(' or '),
    after,
    flips: flips && hasInequality,
    reason: `${branch === 'all' ? '' : `Case ${branch + 1}: `}${action}${flips && hasInequality ? ' Reversed the inequality because the number is negative.' : ''}`,
  };
}
