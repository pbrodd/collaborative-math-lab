// A source-preserving notation tree. Grouping and term order belong to the
// student's working, even when the checker normalizes them to the same value.
export type Expression =
  | { kind: 'number' | 'variable'; value: string }
  | { kind: 'group' | 'absolute' | 'negative'; child: Expression }
  | { kind: 'binary'; op: string; left: Expression; right: Expression };

export function parseExpression(input: string): Expression {
  const source = input
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s/g, '')
    .toLowerCase();
  if (!source || source.length > 240) throw new Error('Enter a short algebraic expression.');
  const tokens = source.match(/\d*\.\d+|\d+|[a-z()+*/|\-]/g) || [];
  if (tokens.join('') !== source)
    throw new Error('Use linear expressions, fractions, parentheses, and absolute values.');
  let i = 0;
  function atom(depth: number): Expression {
    if (depth > 32) throw new Error('Use fewer nested parentheses.');
    const t = tokens[i++];
    if (t === '-' || t === '+') {
      const child = atom(depth + 1);
      return t === '-' ? { kind: 'negative', child } : child;
    }
    if (t === '(' || t === '|') {
      const child = sum(t === '|', depth + 1);
      if (tokens[i++] !== (t === '(' ? ')' : '|'))
        throw new Error('Close every parenthesis and absolute-value pair.');
      return { kind: t === '(' ? 'group' : 'absolute', child };
    }
    if (/^(\d|\.)/.test(t || '')) return { kind: 'number', value: t };
    if (/^[a-z]$/.test(t || '')) return { kind: 'variable', value: t };
    throw new Error('Finish the expression with a number or variable.');
  }
  function product(inAbs: boolean, depth: number): Expression {
    let left = atom(depth);
    while (i < tokens.length) {
      const t = tokens[i];
      const implicit = /^(\d|\.|[a-z]|\()/.test(t) || (t === '|' && !inAbs);
      if (t !== '*' && t !== '/' && !implicit) break;
      const op = implicit ? '*' : tokens[i++];
      left = { kind: 'binary', op, left, right: atom(depth) };
    }
    return left;
  }
  function sum(inAbs: boolean, depth: number): Expression {
    let left = product(inAbs, depth);
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++];
      left = { kind: 'binary', op, left, right: product(inAbs, depth) };
    }
    return left;
  }
  const node = sum(false, 0);
  if (i !== tokens.length) throw new Error('Check the parentheses and absolute-value bars.');
  return node;
}

function precedence(node: Expression): number {
  return node.kind === 'binary'
    ? node.op === '+' || node.op === '-'
      ? 1
      : 2
    : node.kind === 'negative'
      ? 3
      : 4;
}
export function written(node: Expression): string {
  if (node.kind === 'number' || node.kind === 'variable') return node.value;
  if (node.kind === 'group') return `(${written(node.child)})`;
  if (node.kind === 'absolute') return `|${written(node.child)}|`;
  if (node.kind === 'negative')
    return `-${precedence(node.child) < 3 ? `(${written(node.child)})` : written(node.child)}`;
  if (node.kind !== 'binary') throw new Error('Unknown expression.');
  const left =
    precedence(node.left) < precedence(node) ? `(${written(node.left)})` : written(node.left);
  const right =
    precedence(node.right) < precedence(node) ||
    (['-', '/'].includes(node.op) && precedence(node.right) === precedence(node))
      ? `(${written(node.right)})`
      : written(node.right);
  if (
    node.op === '*' &&
    node.left.kind === 'number' &&
    ['variable', 'group', 'absolute'].includes(node.right.kind)
  )
    return `${left}${right}`;
  return `${left}${node.op === '+' || node.op === '-' ? ` ${node.op} ` : node.op}${right}`;
}
function ungroup(node: Expression): Expression {
  return node.kind === 'group' ? ungroup(node.child) : node;
}
function redundantGroup(node: Expression): boolean {
  const child = ungroup(node);
  return (
    child.kind === 'number' ||
    child.kind === 'variable' ||
    (child.kind === 'binary' && child.op === '/')
  );
}
function expressionLatex(node: Expression): string {
  if (node.kind === 'number' || node.kind === 'variable') return node.value;
  if (node.kind === 'group')
    return redundantGroup(node)
      ? expressionLatex(ungroup(node))
      : `\\left(${expressionLatex(node.child)}\\right)`;
  if (node.kind === 'absolute') return `\\left|${expressionLatex(node.child)}\\right|`;
  if (node.kind === 'negative')
    return `-${precedence(node.child) < 3 ? `\\left(${expressionLatex(node.child)}\\right)` : expressionLatex(node.child)}`;
  if (node.kind !== 'binary') throw new Error('Unknown expression.');
  const left = expressionLatex(node.left),
    right = expressionLatex(node.right);
  if (node.op === '/')
    return `\\frac{${expressionLatex(ungroup(node.left))}}{${expressionLatex(ungroup(node.right))}}`;
  if (node.op === '*') {
    const a = precedence(node.left) < 2 ? `\\left(${left}\\right)` : left;
    const b = precedence(node.right) < 2 ? `\\left(${right}\\right)` : right;
    return `${a}${['variable', 'group', 'absolute'].includes(node.right.kind) ? ' ' : '\\cdot '}${b}`;
  }
  return `${left}${node.op}${node.op === '-' && precedence(node.right) === 1 ? `\\left(${right}\\right)` : right}`;
}
export function toLatex(source: string): string {
  const text = source
    .trim()
    .toLowerCase()
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/∨/g, ' or ')
    .replace(/∧/g, ' and ');
  if (/^(no solutions?|all real( numbers)?|all solutions)$/.test(text)) return `\\text{${text}}`;
  return text
    .split(/(\s+or\s+|\s+and\s+|<=|>=|=|<|>)/)
    .map((part) => {
      if (/^\s+or\s+$/.test(part)) return '\\;\\text{or}\\;';
      if (/^\s+and\s+$/.test(part)) return '\\;\\text{and}\\;';
      if (['=', '<', '>', '<=', '>='].includes(part))
        return ({ '<=': '\\le ', '>=': '\\ge ' } as Record<string, string>)[part] || part;
      return expressionLatex(parseExpression(part));
    })
    .join('');
}

export function spokenMath(source: string): string {
  function speak(node: Expression): string {
    if (node.kind === 'number' || node.kind === 'variable') return node.value;
    if (node.kind === 'group')
      return redundantGroup(node)
        ? speak(ungroup(node))
        : `open parentheses ${speak(node.child)} close parentheses`;
    if (node.kind === 'absolute')
      return `absolute value of ${speak(node.child)} end absolute value`;
    if (node.kind === 'negative') return `negative ${speak(node.child)}`;
    if (node.kind !== 'binary') return '';
    if (node.op === '/')
      return `fraction ${speak(ungroup(node.left))} over ${speak(ungroup(node.right))} end fraction`;
    const words: Record<string, string> = { '+': 'plus', '-': 'minus', '*': 'times' };
    return `${speak(node.left)} ${words[node.op]} ${speak(node.right)}`;
  }
  if (/^(no solutions?|all real( numbers)?|all solutions)$/i.test(source.trim())) return source;
  const signs: Record<string, string> = {
    '=': 'equals',
    '<': 'less than',
    '>': 'greater than',
    '<=': 'less than or equal to',
    '>=': 'greater than or equal to',
  };
  return source
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .split(/(\s+or\s+|\s+and\s+|<=|>=|=|<|>)/)
    .map(
      (part) =>
        signs[part] || (/^\s+(or|and)\s+$/.test(part) ? part.trim() : speak(parseExpression(part))),
    )
    .join(' ');
}

// Only these MathLive constructs translate to the checker's grammar. Never
// strip unknown commands: doing so could turn an unsupported claim into a true one.
export function fromLatex(latex: string): string {
  if (latex.length > 2000) throw new Error('Keep the equation short.');
  let i = 0;
  function group(depth: number): string {
    while (/\s/.test(latex[i] || '') && i < latex.length) i++;
    if (latex[i++] !== '{') throw new Error('Finish the fraction or group.');
    return read(true, depth + 1);
  }
  function argument(depth: number): string {
    while (i < latex.length && /\s/.test(latex[i])) i++;
    if (latex[i] === '{') return group(depth);
    // MathLive uses compact TeX (e.g. \frac15) for single-token arguments.
    if (/^[a-z0-9]$/i.test(latex[i] || '')) return latex[i++];
    throw new Error('Finish the fraction or group.');
  }
  function read(inGroup: boolean, depth: number): string {
    if (depth > 32) throw new Error('Use fewer nested groups.');
    let out = '';
    while (i < latex.length) {
      const c = latex[i++];
      if (c === '}') {
        if (!inGroup) throw new Error('Check the grouping.');
        return out;
      }
      if (c === '{') {
        out += `(${read(true, depth + 1)})`;
        continue;
      }
      if (c !== '\\') {
        if (!/[a-z0-9.\s()+*/|=<>\-−]/i.test(c))
          throw new Error(
            'This editor checks linear algebra. Use numbers, single-letter variables, and the algebra keys.',
          );
        out += c === '−' ? '-' : c;
        continue;
      }
      const command = latex.slice(i).match(/^[a-zA-Z]+/)?.[0];
      if (!command) {
        const spacing = latex[i++];
        if ([',', ';', '!', ' '].includes(spacing)) continue;
        throw new Error('This notation is outside the algebra checker.');
      }
      i += command.length;
      if (['left', 'right', 'mleft', 'mright'].includes(command)) continue;
      if (['quad', 'qquad'].includes(command)) {
        out += ' ';
        continue;
      }
      if (['frac', 'dfrac', 'tfrac'].includes(command)) {
        const numerator = argument(depth),
          denominator = argument(depth);
        if (!numerator.trim() || !denominator.trim())
          throw new Error('Fill both parts of the fraction.');
        out += `((${numerator})/(${denominator}))`;
        continue;
      }
      if (command === 'text' || command === 'mathrm' || command === 'operatorname') {
        const word = group(depth).trim();
        if (!/^(or|and|no solutions?|all real( numbers)?|all solutions)$/.test(word))
          throw new Error('Use single-letter variables in equations.');
        out += ` ${word} `;
        continue;
      }
      const symbol = (
        {
          times: '*',
          cdot: '*',
          div: '/',
          le: '<=',
          leq: '<=',
          ge: '>=',
          geq: '>=',
          lt: '<',
          gt: '>',
          lor: ' or ',
          vee: ' or ',
          land: ' and ',
          wedge: ' and ',
          lvert: '|',
          rvert: '|',
          vert: '|',
        } as Record<string, string>
      )[command];
      if (!symbol) throw new Error(`The algebra checker does not support \\${command}.`);
      out += symbol;
    }
    if (inGroup) throw new Error('Finish the group.');
    return out;
  }
  const source = read(false, 0).trim().replace(/\s+/g, ' ');
  if (source.length > 240) throw new Error('Keep each equation within 240 characters.');
  if (!source) throw new Error('Write an equation first.');
  // Parsing also detects empty placeholders and unfinished pairs.
  toLatex(source);
  return source;
}
