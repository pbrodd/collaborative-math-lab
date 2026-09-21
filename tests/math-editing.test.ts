import test from 'node:test';
import assert from 'node:assert/strict';
import { equivalent } from '../lib/algebra.ts';
import { previewMove, choices, type Move } from '../lib/algebra-moves.ts';
import { fromLatex, toLatex, parseExpression, written } from '../lib/math-notation.ts';

const examples = [
  '3(x-2)=15',
  '4(x-3)=2x+10',
  '1500(1-r)=1200',
  'd=1800+200u',
  'u=(d-1800)/200',
  '1/200d=u+9',
  '3|x-4|+2=11',
  'x=1 or x=7',
  'x>=2 and x<=5',
  '-2<x<4',
  'no solution',
  'all real numbers',
  '0.1x=0.3',
  'x/3=2/7',
  'x-(2-x)=3',
  'x/(2/3)=9',
  '-(x+2)=-7',
  '|x|=x',
];
for (const source of examples)
  test(`MathLive notation preserves ${source}`, () => {
    const restored = fromLatex(toLatex(source));
    assert.equal(equivalent(source, restored).valid, true, restored);
  });
test('fractions have explicit numerator and denominator, including fractional coefficients', () => {
  assert.equal(toLatex('1/200d'), '\\frac{1}{200} d');
  assert.equal(toLatex(fromLatex('r=\\frac{1}{5}')), 'r=\\frac{1}{5}');
  for (const compact of ['r=\\frac15', 'r=\\frac{1}5', 'r=\\frac1{5}'])
    assert.equal(toLatex(fromLatex(compact)), 'r=\\frac{1}{5}');
  assert.equal(toLatex('(d-1800)/200'), '\\frac{d-1800}{200}');
  assert.equal(equivalent('x=(2+4)/(3+6)', `x=${fromLatex('\\frac{2+4}{3+6}')}`).valid, true);
});
test('unknown notation and incomplete placeholders cannot silently change a claim', () => {
  for (const latex of [
    'x^2=4',
    '\\sqrt{x}=2',
    '\\frac{}{2}=1',
    '\\frac{1}{\\placeholder{}}=2',
    'x\\unknown=2',
    '\\text{hello}',
    'x=\\infty',
    '\\left(x+1',
    'x=1_{2}',
    '\\href{evil}{x}=2',
  ]) {
    assert.throws(() => fromLatex(latex), Error, latex);
  }
});
test('notation retains written grouping and order', () => {
  assert.equal(written(parseExpression('1500(1-r)')), '1500(1 - r)');
  assert.equal(written(parseExpression('x-(2-x)')), 'x - (2 - x)');
  assert.equal(toLatex('x-(2-x)'), 'x-\\left(2-x\\right)');
});
test('subtracting a variable preserves an unexpanded group', () => {
  const move = previewMove('4(x-3)=2x+10', 'subtract', '2x');
  assert.equal(move.after, '4(x - 3) - 2x = 10');
  assert.match(move.working, /\(2x\).*\(2x\)/);
  assert.equal(equivalent(move.before, move.after).valid, true);
});
test('cancellation retains the student’s term order', () => {
  assert.equal(previewMove('1500(1-r)=1200', 'divide', '1500').after, '1 - r = 4/5');
  assert.equal(previewMove('3(x-2)=15', 'divide', '3').after, 'x - 2 = 5');
  assert.equal(previewMove('3x+7=19', 'subtract', '7').after, '3x = 12');
  assert.equal(previewMove('d-1800=200u', 'divide', '200').after, '(d - 1800)/200 = u');
});
test('distribution and collection are available as explicit moves', () => {
  assert.equal(previewMove('4(x-3)=2x+10', 'distribute').after, '4x - 12 = 2x + 10');
  assert.equal(previewMove('4x-12-2x=10', 'combine').after, '2x - 12 = 10');
  const selected = previewMove('2(x+1)+3(x-2)=10', 'distribute', '', 'all', {
    clause: 0,
    side: 'left',
    term: 0,
  });
  assert.equal(selected.after, '2x + 2 + 3(x - 2) = 10');
});
test('negative multipliers reverse inequalities and explain why', () => {
  const move = previewMove('-2x<4', 'divide', '-2');
  assert.equal(move.after, 'x > -2');
  assert.equal(move.flips, true);
  assert.match(move.reason, /negative/);
  assert.equal(previewMove('x<=2', 'multiply', '3').flips, false);
});
test('one branch can change while the other remains visible and unchanged', () => {
  const move = previewMove('x-4=3 or x-4=-3', 'add', '4', 0);
  assert.equal(move.after, 'x = 7 or x-4=-3');
  assert.equal(previewMove(move.after, 'add', '4', 1).after, 'x = 7 or x = 1');
  assert.match(move.reason, /^Case 1:/);
  assert.throws(() => previewMove(move.after, 'add', '4', 9), /existing case/);
});
test('absolute value handles equality, inside bounds, outside cases, zero and negative distances', () => {
  for (const source of [
    '|x-4|=3',
    '|x-4|=0',
    '|x|=-3',
    '|x-4|<3',
    '|x-4|<=3',
    '|x-4|>3',
    '|x-4|>=3',
    '|x|<0',
    '|x|<=0',
    '|x|>0',
    '|x|>=0',
    '|x|>-2',
    '|x|<=-2',
    '3>|x-4|',
  ]) {
    const move = previewMove(source, 'split');
    assert.equal(equivalent(source, move.after).valid, true, `${source}: ${move.after}`);
  }
  assert.throws(() => previewMove('3|x-4|+2=11', 'split'), /Isolate/);
  assert.equal(previewMove('x-4>-3 and x-4<3', 'add', '4').after, 'x > 1 and x < 7');
});
test('unsafe, unsupported and zero operations cannot be kept as moves', () => {
  for (const operation of ['multiply', 'divide'] as Move[]) {
    for (const amount of ['0', 'x', 'x-x', '1/0'])
      assert.throws(() => previewMove('x=2', operation, amount));
  }
  assert.throws(() => previewMove('x=2', 'add', 'y'));
  assert.throws(() => previewMove('x*x=4', 'subtract', '1'));
  assert.throws(() => previewMove('x=2', 'add', '|x|'));
});
test('term actions reflect the selected coefficient, sign and group', () => {
  assert.ok(
    choices(parseExpression('3x')).some((c) => c.operation === 'divide' && c.amount === '3'),
  );
  assert.equal(choices(parseExpression('-7'))[0].amount, '7');
  assert.equal(choices(parseExpression('-7'))[0].operation, 'add');
  assert.ok(choices(parseExpression('4(x-3)')).some((c) => c.operation === 'distribute'));
});
test('different valid student strategies reach the same solution without skipping operations', () => {
  let first = '4(x-3)=2x+10';
  for (const [operation, amount] of [
    ['distribute', ''],
    ['subtract', '2x'],
    ['add', '12'],
    ['divide', '2'],
  ] as [Move, string][])
    first = previewMove(first, operation, amount).after;
  assert.equal(first, 'x = 11');
  let second = previewMove('3(x-2)=15', 'divide', '3').after;
  second = previewMove(second, 'add', '2').after;
  assert.equal(second, 'x = 7');
});
test('signed rational moves preserve all solutions across varied linear equations', () => {
  for (let coefficient = -4; coefficient <= 4; coefficient++) {
    if (!coefficient) continue;
    for (let constant = -3; constant <= 3; constant++) {
      const source = `${coefficient}x+(${constant})=7`;
      for (const [op, amount] of [
        ['subtract', '2x'],
        ['add', '-3/7'],
        ['multiply', '-2/3'],
        ['divide', '3/2'],
        ['distribute', ''],
      ] as [Move, string][]) {
        const result = previewMove(source, op, amount);
        assert.equal(equivalent(source, result.after).valid, true, JSON.stringify(result));
        assert.equal(equivalent(source, result.working).valid, true, JSON.stringify(result));
        assert.equal(equivalent(source, fromLatex(toLatex(result.after))).valid, true);
      }
    }
  }
});
