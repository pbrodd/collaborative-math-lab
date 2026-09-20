// Independent, bounded translation of written algebra to propositions over ℝ.
// This module never calls the app's solver and never treats generated code as a proof.
export const PROOF_FORMAT = 1;
export const LEAN_VERSION = '4.19.0';
export const MATHLIB_REVISION = 'c44e0c8ee63ca166450922a373c7409c5d26b00b';
export type ProofRequest = {
  before: string;
  after: string;
  constraints?: string[];
  kind?: 'solution' | 'step';
};
type Rational = { n: bigint; d: bigint };
type Expression = { lean: string; constant: Rational | null; variables: Set<string>; abs: number };
type Proposition = { lean: string; variables: Set<string>; abs: number };
export type ProofClaim = {
  request: ProofRequest;
  statement: string;
  source: string;
  variables: string[];
};
function rational(n: bigint, d = 1n): Rational {
  if (!d) throw new Error('Division by zero is undefined; no proof will be generated.');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  let a = n < 0n ? -n : n,
    b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
function normalized(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/∨/g, ' or ')
    .replace(/∧/g, ' and ');
}
function arithmetic(input: string): Expression {
  const text = input.replace(/\s/g, '');
  if (!text || text.length > 240) throw new Error('Use an expression of 1–240 characters.');
  const tokens = text.match(/\d*\.\d+|\d+|[a-z()+*/|\-]/g) || [];
  if (tokens.join('') !== text)
    throw new Error(
      'Use numbers, single-letter variables, +, −, ×, /, parentheses, and absolute-value bars.',
    );
  let index = 0;
  function atom(depth: number): Expression {
    if (depth > 24) throw new Error('This expression has too many nested operations.');
    const token = tokens[index++];
    if (token === '+' || token === '-') {
      const child = atom(depth + 1);
      return token === '+'
        ? child
        : {
            ...child,
            lean: `(-${child.lean})`,
            constant: child.constant ? rational(-child.constant.n, child.constant.d) : null,
          };
    }
    if (token === '(' || token === '|') {
      const child = sum(token === '|', depth + 1);
      if (tokens[index++] !== (token === '(' ? ')' : '|'))
        throw new Error('Close every parenthesis and absolute-value pair.');
      if (token === '(') return child;
      if (child.abs) throw new Error('Nested absolute values are outside this proof translator.');
      return {
        ...child,
        lean: `|${child.lean}|`,
        abs: 1,
        constant: child.constant
          ? rational(child.constant.n < 0n ? -child.constant.n : child.constant.n, child.constant.d)
          : null,
      };
    }
    if (/^\d*\.?\d+$/.test(token || '')) {
      if (token.replace('.', '').length > 12)
        throw new Error('Use numbers with at most 12 digits.');
      const [whole, fraction = ''] = token.split('.');
      const value = rational(BigInt((whole || '0') + fraction), 10n ** BigInt(fraction.length));
      return {
        lean: value.d === 1n ? `(${value.n} : ℝ)` : `((${value.n} : ℝ) / ${value.d})`,
        constant: value,
        variables: new Set(),
        abs: 0,
      };
    }
    if (/^[a-z]$/.test(token || ''))
      return { lean: `v_${token}`, constant: null, variables: new Set([token]), abs: 0 };
    throw new Error('An expression is missing a number or variable.');
  }
  function binary(a: Expression, op: string, b: Expression): Expression {
    if (op === '/' && !b.constant)
      throw new Error('The Lean translator supports only constant denominators.');
    if (op === '/' && b.constant!.n === 0n)
      throw new Error('Division by zero is undefined; no proof will be generated.');
    if (op === '*' && !a.constant && !b.constant)
      throw new Error('The Lean translator currently supports linear expressions.');
    let constant: Rational | null = null;
    if (a.constant && b.constant) {
      const x = a.constant,
        y = b.constant;
      constant =
        op === '+'
          ? rational(x.n * y.d + y.n * x.d, x.d * y.d)
          : op === '-'
            ? rational(x.n * y.d - y.n * x.d, x.d * y.d)
            : op === '*'
              ? rational(x.n * y.n, x.d * y.d)
              : rational(x.n * y.d, x.d * y.n);
    }
    return {
      lean: `(${a.lean} ${op} ${b.lean})`,
      constant,
      variables: new Set([...a.variables, ...b.variables]),
      abs: a.abs + b.abs,
    };
  }
  function product(inAbs: boolean, depth: number): Expression {
    let left = atom(depth);
    while (index < tokens.length) {
      const token = tokens[index];
      const implicit = /^(\d|\.|[a-z]|\()/.test(token) || (token === '|' && !inAbs);
      if (!implicit && token !== '*' && token !== '/') break;
      left = binary(left, implicit ? '*' : tokens[index++], atom(depth));
    }
    return left;
  }
  function sum(inAbs: boolean, depth: number): Expression {
    let left = product(inAbs, depth);
    while (tokens[index] === '+' || tokens[index] === '-')
      left = binary(left, tokens[index++], product(inAbs, depth));
    return left;
  }
  const result = sum(false, 0);
  if (index !== tokens.length) throw new Error('Check the grouping of the expression.');
  return result;
}
function join(parts: Proposition[], operator: string): Proposition {
  return {
    lean:
      parts.length === 1 ? parts[0].lean : `(${parts.map((p) => p.lean).join(` ${operator} `)})`,
    variables: new Set(parts.flatMap((p) => [...p.variables])),
    abs: parts.reduce((n, p) => n + p.abs, 0),
  };
}
function proposition(raw: string): Proposition {
  const text = normalized(raw);
  if (!text || text.length > 1200) throw new Error('Supply a relationship of 1–1,200 characters.');
  if (text === 'no solution') return { lean: 'False', variables: new Set(), abs: 0 };
  if (text === 'all real numbers') return { lean: 'True', variables: new Set(), abs: 0 };
  const branches = text.split(/\bor\b/);
  if (branches.length > 8) throw new Error('Use at most eight solution branches.');
  return join(
    branches.map((branch) => {
      const clauses = branch.split(/\band\b/);
      if (clauses.length > 8) throw new Error('Use at most eight joined conditions.');
      return join(
        clauses.map((clause) => {
          const parts = clause.split(/(<=|>=|=|<|>)/);
          if (parts.length < 3 || parts.length > 7)
            throw new Error(
              'Write an equation or inequality, with complete branches joined by “or” or “and”.',
            );
          const expressions = parts.filter((_, i) => i % 2 === 0).map(arithmetic);
          return join(
            expressions.slice(1).map((right, i) => {
              const left = expressions[i];
              const op =
                ({ '<=': '≤', '>=': '≥' } as Record<string, string>)[parts[2 * i + 1]] ||
                parts[2 * i + 1];
              return {
                lean: `(${left.lean} ${op} ${right.lean})`,
                variables: new Set([...left.variables, ...right.variables]),
                abs: left.abs + right.abs,
              };
            }),
            '∧',
          );
        }),
        '∧',
      );
    }),
    '∨',
  );
}
export const LEAN_HEADER = `import Mathlib

-- Generated from parsed mathematics, never from a student's Lean code.
-- Real-number equivalence: both directions, for every value of every variable.
set_option autoImplicit false
set_option maxHeartbeats 400000
set_option maxRecDepth 1000

theorem lab_abs_cases (x : ℝ) : |x| = (if 0 ≤ x then x else -x) := by
  split_ifs with h
  · exact abs_of_nonneg h
  · exact abs_of_neg (lt_of_not_ge h)

`;
export function proofDeclaration(statement: string, name = 'algebra_claim'): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Invalid theorem name.');
  return `theorem ${name} : ${statement} := by
  intros
  (try simp only [lab_abs_cases]) <;> (try split_ifs) <;>
    aesop (config := { enableSimp := false }) (add safe (by linarith))

#print axioms ${name}
`;
}
export function buildProof(request: ProofRequest): ProofClaim {
  if (!request || typeof request.before !== 'string' || typeof request.after !== 'string')
    throw new Error('Supply a starting relationship and a proposed result.');
  if (request.kind && !['step', 'solution'].includes(request.kind))
    throw new Error('Choose a step or complete-solution proof.');
  if (
    request.constraints &&
    (!Array.isArray(request.constraints) ||
      request.constraints.length > 8 ||
      request.constraints.some((c) => typeof c !== 'string'))
  )
    throw new Error('Supply at most eight written constraints.');
  const constraints = (request.constraints || []).filter((c) => c.trim()).map(proposition);
  const before = join([proposition(request.before), ...constraints], '∧');
  const after = join(
    [proposition(request.after), ...(request.kind === 'step' ? constraints : [])],
    '∧',
  );
  const variables = [...new Set([...before.variables, ...after.variables])].sort();
  if (variables.length > 4 || before.abs + after.abs > 8)
    throw new Error('Use at most four variables and eight absolute-value occurrences in a proof.');
  const statement = `${variables.length ? `∀ (${variables.map((v) => `v_${v}`).join(' ')} : ℝ), ` : ''}${before.lean} ↔ ${after.lean}`;
  return { request, statement, source: LEAN_HEADER + proofDeclaration(statement), variables };
}
export async function proofDigest(claim: ProofClaim): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(claim.source));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
