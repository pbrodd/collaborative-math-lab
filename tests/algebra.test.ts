import test from 'node:test';
import assert from 'node:assert/strict';
import {
  equivalent,
  analyze,
  transform,
  numberValue,
  evaluateAt,
  isIsolated,
} from '../lib/algebra.ts';
const good: [string, string][] = [
  ['3(x-2)=15', 'x=7'],
  ['3(x-2)=15', '3x-6=15'],
  ['3(x-2)=15', 'x-2=5'],
  ['4(x-3)=2x+10', 'x=11'],
  ['1500(1-r)=1200', 'r=1/5'],
  ['d=1800+200u', 'u=(d-1800)/200'],
  ['d=1800+200u', '(d-1800)/200=u'],
  ['3|x-4|+2=11', 'x=1 or x=7'],
  ['3|x-4|+2=11', 'x-4=3 or x-4=-3'],
  ['|x-4|=0', 'x=4'],
  ['|x-4|=-3', 'no solution'],
  ['2x+1=2x+2', 'no solution'],
  ['2(x+1)=2x+2', 'all real numbers'],
  ['|x|=x', 'x>=0'],
  ['|x|=-x', 'x<=0'],
  ['|x|<2', '-2<x<2'],
  ['-2x<4', 'x>-2'],
  ['0.1x=0.3', 'x=3'],
  ['x/3=2/7', 'x=6/7'],
  ['|x-2|=|x+2|', 'x=0'],
];
for (const [a, b] of good)
  test(`preserves ${a} → ${b}`, () =>
    assert.equal(equivalent(a, b).valid, true, equivalent(a, b).message));
for (const [a, b] of [
  ['3(x-2)=15', '3x-2=15'],
  ['3x=12', 'x=9'],
  ['-x=4', 'x=4'],
  ['3|x-4|+2=11', 'x=7'],
  ['|x-4|=3', 'x=1 or x=7 or x=4'],
  ['d=1800+200u', 'u=d-1800/200'],
  ['x=2', '0=0'],
  ['x<2', 'x<=2'],
  ['x=2', 'y=2'],
  ['x=2', 'x*x=4'],
  ['x=2', 'x=2/0'],
  ['x=2', 'process.exit()'],
  ['x=2', 'x==2'],
  ['x=2', 'x=2 trailing'],
])
  test(`rejects ${a} → ${b}`, () => assert.equal(equivalent(a, b).valid, false));
test('intersects arrival tolerance with the deadline', () =>
  assert.deepEqual(analyze('|s+6-20|<=2', ['s+6<=21']).values, ['12 ≤ s ≤ 15']));
test('supports explicit conjunctions and chained interval answers', () =>
  assert.equal(equivalent('x>=2 and x<=5', '2<=x<=5').valid, true));
test('rejects nonlinear multivariate author equations', () =>
  assert.equal(analyze('x*x=y').kind, 'unsupported'));
test('keeps intentional contradictory constraints', () =>
  assert.equal(analyze('x>=4', ['x<4']).count, 0));
test('strict endpoints do not create a phantom solution', () =>
  assert.equal(analyze('x>2', ['x<=2']).count, 0));
test('a point can lie on both inclusive boundaries', () =>
  assert.deepEqual(analyze('x>=2', ['x<=2']).values, ['x = 2']));
test('absolute value below zero has no solutions', () => assert.equal(analyze('|x|<0').count, 0));
test('absolute value at least zero includes every real', () =>
  assert.equal(analyze('|x|>=0').description, 'A solution region: all real numbers'));
test('zero multiplier is rejected as an algebra move', () =>
  assert.throws(() => transform('x=3', 'multiply', '0'), /nonzero/));
test('zero divisor is rejected as an algebra move', () =>
  assert.throws(() => transform('x=3', 'divide', '0'), /nonzero/));
test('division applies to each full side', () =>
  assert.equal(transform('3(x-2)=15', 'divide', '3'), 'x - 2 = 5'));
test('splitting needs an isolated absolute value', () =>
  assert.throws(() => transform('3|x-4|+2=11', 'split', ''), /Isolate/));
test('opens and maintains two branches', () => {
  const split = transform('|x-4|=3', 'split', '');
  assert.equal(equivalent(split, 'x=1 or x=7').valid, true);
  assert.equal(equivalent('|x-4|=3', transform(split, 'add', '4')).valid, true);
});
test('negative distance opens no paths', () =>
  assert.equal(transform('|x|=-3', 'split', ''), 'no solution'));
test('zero distance opens one path', () =>
  assert.equal(transform('|x-4|=0', 'split', ''), 'x - 4 = 0'));
test('recognizes isolation without requiring a preferred side', () => {
  assert.equal(isIsolated('(d-1800)/200=u', 'u'), true);
  assert.equal(isIsolated('2u=d', 'u'), false);
});
test('calculator and graph support fractions and distance', () => {
  assert.equal(numberValue('3/4+1/4'), 1);
  assert.equal(evaluateAt('y=|x-4|', 1), 3);
  assert.equal(evaluateAt('y=x*x', 3), 9);
});
test('many signed affine relationships preserve the constructed solution', () => {
  for (let a = -5; a <= 5; a++) {
    if (!a) continue;
    for (let root = -7; root <= 7; root++) {
      const b = 3 - root;
      const equation = `${a}(x+(${b}))=${a * (root + b)}`;
      assert.equal(equivalent(equation, `x=${root}`).valid, true, equation);
    }
  }
});
