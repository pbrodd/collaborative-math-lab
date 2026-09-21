// A deliberately bounded, exact checker for affine algebra and absolute values.
// No eval, floating-point sampling, or language-model grading.
export type Q = { n: bigint; d: bigint };
const z = BigInt(0),
  o = BigInt(1);
function gcd(a: bigint, b: bigint): bigint {
  a = a < z ? -a : a;
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || o;
}
function q(n: bigint | number, d: bigint | number = o): Q {
  n = BigInt(n);
  d = BigInt(d);
  if (!d) throw new Error('Division by zero is undefined.');
  if (d < z) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const neg = (a: Q) => q(-a.n, a.d);
const sub = (a: Q, b: Q) => add(a, neg(b));
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const cmp = (a: Q, b: Q) => {
  const v = a.n * b.d - b.n * a.d;
  return v < z ? -1 : v > z ? 1 : 0;
};
const str = (a: Q) => (a.d === o ? String(a.n) : `${a.n}/${a.d}`);
function decimal(s: string): Q {
  if (s.length > 14) throw new Error('Use numbers with at most 12 digits.');
  const [a, b = ''] = s.split('.');
  return q(BigInt((a || '0') + b), BigInt(10) ** BigInt(b.length));
}
type Node =
  | { kind: 'num'; value: Q }
  | { kind: 'var'; name: string }
  | { kind: 'neg'; child: Node }
  | { kind: 'abs'; child: Node }
  | { kind: 'bin'; op: string; left: Node; right: Node };
export function clean(s: string) {
  return s
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/∨/g, ' or ')
    .trim()
    .toLowerCase();
}
function parse(input: string): Node {
  const source = clean(input).replace(/\s/g, '');
  if (!source || source.length > 240) throw new Error('Enter a short algebraic expression.');
  const tokens = source.match(/\d*\.\d+|\d+|[a-z()+*/|\-]/g) || [];
  if (tokens.join('') !== source)
    throw new Error('Use numbers, single-letter variables, +, −, ×, /, parentheses, and | |.');
  let i = 0;
  function atom(): Node {
    const t = tokens[i++];
    if (t === '-' || t === '+') return t === '-' ? { kind: 'neg', child: atom() } : atom();
    if (t === '(') {
      const result = sum(false);
      if (tokens[i++] !== ')') throw new Error('Close the parentheses.');
      return result;
    }
    if (t === '|') {
      const child = sum(true);
      if (tokens[i++] !== '|') throw new Error('Close the absolute-value bars.');
      return { kind: 'abs', child };
    }
    if (/^(\d|\.)/.test(t || '')) return { kind: 'num', value: decimal(t) };
    if (/^[a-z]$/.test(t || '')) return { kind: 'var', name: t };
    throw new Error('An expression is missing a number or variable.');
  }
  function product(inAbs: boolean): Node {
    let n = atom();
    while (i < tokens.length) {
      const t = tokens[i];
      const implicit = /^(\d|\.|[a-z]|\()/.test(t) || (t === '|' && !inAbs);
      if (t !== '*' && t !== '/' && !implicit) break;
      const op = implicit ? '*' : tokens[i++];
      n = { kind: 'bin', op, left: n, right: atom() };
    }
    return n;
  }
  function sum(inAbs: boolean): Node {
    let n = product(inAbs);
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++];
      n = { kind: 'bin', op, left: n, right: product(inAbs) };
    }
    return n;
  }
  const result = sum(false);
  if (i !== tokens.length) throw new Error('Check your parentheses and absolute-value bars.');
  return result;
}
type Affine = Map<string, Q>;
const constant = (v: Q) => new Map<string, Q>([['', v]]);
function combine(a: Affine, b: Affine, factor = q(1)): Affine {
  const out = new Map(a);
  for (const [k, v] of b) {
    const value = add(out.get(k) || q(0), mul(v, factor));
    if (value.n) out.set(k, value);
    else out.delete(k);
  }
  return out;
}
function scale(a: Affine, c: Q) {
  return new Map(
    [...a].map(([k, v]) => [k, mul(v, c)]).filter(([, v]) => (v as Q).n !== z) as [string, Q][],
  );
}
const isConstant = (a: Affine) => [...a].every(([k, v]) => !k || !v.n);
function affine(n: Node, absValue?: (n: Node) => Affine): Affine {
  if (n.kind === 'num') return constant(n.value);
  if (n.kind === 'var') return new Map([[n.name, q(1)]]);
  if (n.kind === 'neg') return scale(affine(n.child, absValue), q(-1));
  if (n.kind === 'abs') {
    if (!absValue) throw new Error('Absolute value needs its own solution paths.');
    return absValue(n.child);
  }
  const a = affine(n.left, absValue),
    b = affine(n.right, absValue);
  if (n.op === '+') return combine(a, b);
  if (n.op === '-') return combine(a, b, q(-1));
  if (n.op === '/') {
    if (!isConstant(b)) throw new Error('This checker supports division by constant numbers.');
    return scale(a, div(q(1), b.get('') || q(0)));
  }
  if (isConstant(a)) return scale(b, a.get('') || q(0));
  if (isConstant(b)) return scale(a, b.get('') || q(0));
  throw new Error(
    'This notebook checks linear expressions; multiplying variables is outside this mission.',
  );
}
function vars(n: Node): string[] {
  if (n.kind === 'var') return [n.name];
  if (n.kind === 'num') return [];
  if (n.kind === 'bin') return [...vars(n.left), ...vars(n.right)];
  return vars(n.child);
}
function absolutes(n: Node): Node[] {
  if (n.kind === 'abs') return [n.child];
  if (n.kind === 'bin') return [...absolutes(n.left), ...absolutes(n.right)];
  if (n.kind === 'neg') return absolutes(n.child);
  return [];
}
type Relation = { left: Node; right: Node; op: string };
function relation(s: string): Relation {
  const pieces = clean(s).split(/(<=|>=|=|<|>)/);
  if (pieces.length !== 3)
    throw new Error('Write both sides of one equation, or join complete branches with “or”.');
  return { left: parse(pieces[0]), op: pieces[1], right: parse(pieces[2]) };
}
type Interval = { lo: Q | null; hi: Q | null; lc: boolean; hc: boolean };
const all = (): Interval => ({ lo: null, hi: null, lc: false, hc: false });
function intersect(a: Interval, b: Interval): Interval | null {
  let lo = a.lo,
    lc = a.lc,
    hi = a.hi,
    hc = a.hc;
  if (b.lo && (!lo || cmp(b.lo, lo) > 0)) {
    lo = b.lo;
    lc = b.lc;
  } else if (b.lo && lo && !cmp(b.lo, lo)) lc = lc && b.lc;
  if (b.hi && (!hi || cmp(b.hi, hi) < 0)) {
    hi = b.hi;
    hc = b.hc;
  } else if (b.hi && hi && !cmp(b.hi, hi)) hc = hc && b.hc;
  if (lo && hi && (cmp(lo, hi) > 0 || (!cmp(lo, hi) && !(lc && hc)))) return null;
  return { lo, hi, lc, hc };
}
function normalized(items: Interval[]): Interval[] {
  const list = items.sort((a, b) =>
    !a.lo ? -1 : !b.lo ? 1 : cmp(a.lo, b.lo) || Number(b.lc) - Number(a.lc),
  );
  const out: Interval[] = [];
  for (const v of list) {
    const last = out.at(-1);
    if (!last) {
      out.push({ ...v });
      continue;
    }
    const overlap =
      !last.hi ||
      !v.lo ||
      cmp(last.hi, v.lo) > 0 ||
      (cmp(last.hi, v.lo) === 0 && (last.hc || v.lc));
    if (!overlap) {
      out.push({ ...v });
      continue;
    }
    if (last.hi && (!v.hi || cmp(v.hi, last.hi) > 0)) {
      last.hi = v.hi;
      last.hc = v.hc;
    } else if (last.hi && v.hi && !cmp(last.hi, v.hi)) last.hc = last.hc || v.hc;
  }
  return out;
}
function holds(value: Q, op: string) {
  const c = cmp(value, q(0));
  return op === '='
    ? c === 0
    : op === '<'
      ? c < 0
      : op === '>'
        ? c > 0
        : op === '<='
          ? c <= 0
          : c >= 0;
}
function linearSet(a: Q, b: Q, op: string): Interval[] {
  if (!a.n) return holds(b, op) ? [all()] : [];
  const root = div(neg(b), a);
  if (op === '=') return [{ lo: root, hi: root, lc: true, hc: true }];
  if (a.n < z) op = ({ '<': '>', '>': '<', '<=': '>=', '>=': '<=' } as Record<string, string>)[op];
  return op.startsWith('<')
    ? [{ lo: null, hi: root, lc: false, hc: op === '<=' }]
    : [{ lo: root, hi: null, lc: op === '>=', hc: false }];
}
function solve(r: Relation, variable: string): Interval[] {
  const inner = [...absolutes(r.left), ...absolutes(r.right)];
  if (inner.length > 4) throw new Error('Use at most four absolute-value expressions per step.');
  const breaks: Q[] = [];
  for (const n of inner) {
    const a = affine(n);
    const c = a.get(variable) || q(0);
    if (c.n) breaks.push(div(neg(a.get('') || q(0)), c));
  }
  const boundaries = [
    null,
    ...breaks.sort(cmp).filter((v, i, a) => !i || cmp(v, a[i - 1]) !== 0),
    null,
  ];
  const result: Interval[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const lo = boundaries[i],
      hi = boundaries[i + 1];
    const sample =
      lo && hi ? div(add(lo, hi), q(2)) : lo ? add(lo, q(1)) : hi ? sub(hi, q(1)) : q(0);
    const absFn = (n: Node) => {
      const a = affine(n);
      const value = add(mul(a.get(variable) || q(0), sample), a.get('') || q(0));
      return scale(a, value.n < z ? q(-1) : q(1));
    };
    const f = combine(affine(r.left, absFn), affine(r.right, absFn), q(-1));
    for (const v of linearSet(f.get(variable) || q(0), f.get('') || q(0), r.op)) {
      const intersection = intersect(v, { lo, hi, lc: !!lo, hc: !!hi });
      if (intersection) result.push(intersection);
    }
  }
  return normalized(result);
}
function clauses(s: string) {
  return clean(s).split(/\s+or\s+/);
}
function conjunctions(s: string) {
  return s.split(/\s+and\s+/).flatMap((c) => {
    const p = c.split(/(<=|>=|=|<|>)/);
    return p.length === 5 ? [`${p[0]}${p[1]}${p[2]}`, `${p[2]}${p[3]}${p[4]}`] : [c];
  });
}
function names(s: string) {
  if (/^(no solutions?|all real( numbers)?|all solutions)$/.test(clean(s))) return [];
  return [
    ...new Set(
      clauses(s).flatMap((c) =>
        conjunctions(c).flatMap((v) => {
          const r = relation(v);
          return [...vars(r.left), ...vars(r.right)];
        }),
      ),
    ),
  ].sort();
}
function solutions(s: string, variable: string): Interval[] {
  if (/^no solutions?$/.test(clean(s))) return [];
  if (/^(all real( numbers)?|all solutions)$/.test(clean(s))) return [all()];
  return normalized(
    clauses(s).flatMap((c) => {
      let region = [all()];
      for (const part of conjunctions(c)) {
        const next = solve(relation(part), variable);
        region = normalized(
          region.flatMap((a) =>
            next.flatMap((b) => {
              const v = intersect(a, b);
              return v ? [v] : [];
            }),
          ),
        );
      }
      return region;
    }),
  );
}
const fingerprint = (set: Interval[]) =>
  set
    .map(
      (i) =>
        `${i.lc ? '[' : '('}${i.lo ? str(i.lo) : '-inf'},${i.hi ? str(i.hi) : 'inf'}${i.hc ? ']' : ')'}`,
    )
    .join(';');
export function equivalent(original: string, next: string): { valid: boolean; message: string } {
  try {
    const originalNames = names(original),
      nextNames = names(next);
    if (nextNames.some((n) => !originalNames.includes(n)))
      return {
        valid: false,
        message: 'Keep the same variable names so the equation describes the same quantities.',
      };
    if (originalNames.length > 1) {
      const a = relation(original),
        b = relation(next);
      if (a.op !== '=' || b.op !== '=')
        throw new Error('Literal formulas currently support equality steps.');
      const aa = combine(affine(a.left), affine(a.right), q(-1)),
        bb = combine(affine(b.left), affine(b.right), q(-1));
      const keys = [...new Set([...aa.keys(), ...bb.keys()])];
      let ratio: Q | undefined;
      for (const k of keys) {
        const av = aa.get(k) || q(0),
          bv = bb.get(k) || q(0);
        if (!av.n) {
          if (bv.n)
            return {
              valid: false,
              message: 'This changes the relationship between the variables. Check each term.',
            };
        } else {
          const r = div(bv, av);
          if (!r.n || (ratio && cmp(ratio, r)))
            return { valid: false, message: 'Apply the operation to every term on both sides.' };
          ratio = r;
        }
      }
      return { valid: true, message: 'The relationship between the variables is preserved.' };
    }
    const variable = originalNames[0] || 'x';
    const a = solutions(original, variable),
      b = solutions(next, variable);
    const valid = fingerprint(a) === fingerprint(b);
    return {
      valid,
      message: valid
        ? 'Both lines have exactly the same solutions.'
        : 'This changes the solution set. Check both sides, signs, and every absolute-value branch.',
    };
  } catch (e) {
    return { valid: false, message: e instanceof Error ? e.message : 'Check the equation format.' };
  }
}
export function numberValue(s: string): number {
  const v = constantValue(s);
  return Number(v.n) / Number(v.d);
}
export function constantValue(s: string): Q {
  const a = affine(parse(s));
  if (!isConstant(a)) throw new Error('Enter a number or fraction.');
  return a.get('') || q(0);
}
// Shared exact arithmetic for written moves; the proof translator stays independent.
export const rational = { of: q, add, negate: neg, multiply: mul, divide: div, format: str };
export function isIsolated(s: string, target: string) {
  try {
    return clauses(s).every((c) => {
      const r = relation(c);
      return (
        r.op === '=' &&
        ((r.left.kind === 'var' && r.left.name === target && !vars(r.right).includes(target)) ||
          (r.right.kind === 'var' && r.right.name === target && !vars(r.left).includes(target)))
      );
    });
  } catch {
    return false;
  }
}
function printAffine(a: Affine, absoluteNames = new Map<string, string>()) {
  let result = '';
  const keys = [...a.keys()]
    .filter((k) => a.get(k)!.n)
    .sort((a, b) => (!a ? 1 : !b ? -1 : a.localeCompare(b)));
  for (const k of keys) {
    const v = a.get(k)!;
    const positive = v.n > z;
    const magnitude = q(positive ? v.n : -v.n, v.d);
    const term = k
      ? `${cmp(magnitude, q(1)) === 0 ? '' : str(magnitude)}${absoluteNames.get(k) || k}`
      : str(magnitude);
    result += result ? (positive ? ' + ' : ' - ') + term : (positive ? '' : '-') + term;
  }
  return result || '0';
}
export function simplifySide(s: string) {
  const labels = new Map<string, string>();
  let id = 0;
  const a = affine(parse(s), (n) => {
    const key = `@${id++}`;
    labels.set(key, `|${printAffine(affine(n))}|`);
    return new Map([[key, q(1)]]);
  });
  return printAffine(a, labels);
}
export function transform(equation: string, operation: string, amount: string): string {
  const parts = clauses(equation);
  if (operation === 'split') {
    if (parts.length !== 1)
      throw new Error('The equation already has multiple paths. Work on both paths below.');
    const r = relation(equation);
    const abs = r.left.kind === 'abs' ? r.left : r.right.kind === 'abs' ? r.right : null;
    if (!abs) throw new Error('Isolate the absolute-value expression before opening its paths.');
    const other = abs === r.left ? r.right : r.left;
    const f = affine(other);
    if (!isConstant(f) || r.op !== '=') throw new Error('First write |expression| = a number.');
    const value = f.get('') || q(0);
    const inner = printAffine(affine(abs.child));
    if (value.n < z) return 'no solution';
    return value.n === z
      ? `${inner} = 0`
      : `${inner} = ${str(value)} or ${inner} = ${str(neg(value))}`;
  }
  const operator = (
    { add: '+', subtract: '-', multiply: '*', divide: '/' } as Record<string, string>
  )[operation];
  if (operation !== 'simplify' && !operator) throw new Error('Choose an operation.');
  if (operator) {
    const v = numberValue(amount);
    if (!Number.isFinite(v)) throw new Error('Enter a finite number.');
    if ((operation === 'multiply' || operation === 'divide') && v === 0)
      throw new Error('Use a nonzero number to preserve the solutions.');
  }
  return parts
    .map((part) => {
      const r = relation(part);
      if (r.op !== '=') throw new Error('Use the equation workspace for this operation.');
      const [left, right] = clean(part).split('=');
      return operation === 'simplify'
        ? `${simplifySide(left)} = ${simplifySide(right)}`
        : `${simplifySide(`(${left})${operator}(${amount})`)} = ${simplifySide(`(${right})${operator}(${amount})`)}`;
    })
    .join(' or ');
}

export function analyze(
  input: string,
  constraints: string[] = [],
): { kind: string; description: string; values: string[]; count: number | null } {
  try {
    const expressions = [input, ...constraints].filter((s) => s.trim());
    if (!expressions.length)
      return {
        kind: 'open',
        description: 'An open question. No equation to check yet.',
        values: [],
        count: null,
      };
    const variables = [...new Set(expressions.flatMap(names))];
    if (variables.length > 1) {
      if (expressions.length > 1)
        throw new Error(
          'Constraints involving several variables need a human review or a one-variable reformulation.',
        );
      expressions.forEach((s) => {
        const r = relation(s);
        affine(r.left);
        affine(r.right);
      });
      return {
        kind: 'literal',
        description:
          'A relationship between variables. Supply values or solve for a chosen variable.',
        values: [],
        count: null,
      };
    }
    const variable = variables[0] || 'x';
    let result = [all()];
    for (const expression of expressions) {
      const next = solutions(expression, variable);
      result = normalized(
        result.flatMap((a) =>
          next.flatMap((b) => {
            const c = intersect(a, b);
            return c ? [c] : [];
          }),
        ),
      );
    }
    if (!result.length)
      return {
        kind: 'none',
        description: 'No solution satisfies all of these constraints.',
        values: [],
        count: 0,
      };
    const points = result.every((i) => i.lo && i.hi && cmp(i.lo, i.hi) === 0);
    const values = result.map((i) =>
      i.lo && i.hi && cmp(i.lo, i.hi) === 0
        ? `${variable} = ${str(i.lo)}`
        : !i.lo && !i.hi
          ? 'all real numbers'
          : !i.lo
            ? `${variable} ${i.hc ? '≤' : '<'} ${str(i.hi!)}`
            : !i.hi
              ? `${variable} ${i.lc ? '≥' : '>'} ${str(i.lo)}`
              : `${str(i.lo)} ${i.lc ? '≤' : '<'} ${variable} ${i.hc ? '≤' : '<'} ${str(i.hi)}`,
    );
    return {
      kind: points ? 'points' : 'interval',
      description: points
        ? `${result.length} solution${result.length === 1 ? '' : 's'}: ${values.join(' or ')}`
        : `A solution region: ${values.join(' or ')}`,
      values,
      count: points ? result.length : null,
    };
  } catch (e) {
    return {
      kind: 'unsupported',
      description: e instanceof Error ? e.message : 'This expression cannot be checked yet.',
      values: [],
      count: null,
    };
  }
}
export function evaluateAt(expression: string, x: number): number {
  function evaluate(n: Node): number {
    if (n.kind === 'num') return Number(n.value.n) / Number(n.value.d);
    if (n.kind === 'var') {
      if (n.name !== 'x') throw new Error('Use x as the graph variable.');
      return x;
    }
    if (n.kind === 'neg') return -evaluate(n.child);
    if (n.kind === 'abs') return Math.abs(evaluate(n.child));
    const a = evaluate(n.left),
      b = evaluate(n.right);
    return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : a / b;
  }
  return evaluate(parse(clean(expression).replace(/^y\s*=/, '')));
}
