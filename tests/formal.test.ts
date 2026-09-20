import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProof, proofDigest } from '../lib/formal.ts';
import { auditAxioms } from '../scripts/lean-audit.mjs';

test('translates the written problem directly, including both directions and all variables', () => {
  const claim = buildProof({ before: 'd=1800+200u', after: 'u=(d-1800)/200' });
  assert.deepEqual(claim.variables, ['d', 'u']);
  assert.match(claim.statement, /^∀ \(v_d v_u : ℝ\),/);
  assert.match(claim.statement, /↔/);
  assert.match(claim.source, /#print axioms algebra_claim/);
  assert.doesNotMatch(claim.source, /sorry|native_decide/);
});
test('preserves exact decimal arithmetic', () => {
  const a = buildProof({ before: '0.10x=0.3', after: 'x=3' });
  const b = buildProof({ before: '.1x=.30', after: 'x=3' });
  assert.equal(a.source, b.source);
  assert.match(a.statement, /\(\(1 : ℝ\) \/ 10\)/);
});
test('translates disjunctions and chained constraints without dropping branches', () => {
  assert.match(buildProof({ before: '|x|=2', after: 'x=-2 or x=2' }).statement, /∨/);
  const claim = buildProof({ before: '|x-10|<=3', after: '7<=x<=11', constraints: ['x<=11'] });
  assert.equal((claim.statement.match(/∧/g) || []).length, 2);
  assert.match(claim.statement, /≤ v_x/);
});
test('preserves conjunction precedence inside disjunctions', () => {
  const claim = buildProof({ before: 'x=1 or x>2 and x<4', after: 'x=1 or 2<x<4' });
  assert.match(claim.statement, /∨ \(\(v_x > \(2 : ℝ\)\) ∧ \(v_x < \(4 : ℝ\)\)\)\)/);
});
test('makes complete-solution proofs stronger than steps under assumptions', async () => {
  const input = { before: 'x>=0', after: 'x<=10', constraints: ['x=2'] };
  const step = buildProof({ ...input, kind: 'step' });
  const solution = buildProof({ ...input, kind: 'solution' });
  assert.equal((step.statement.match(/∧/g) || []).length, 2);
  assert.equal((solution.statement.match(/∧/g) || []).length, 1);
  assert.notEqual(await proofDigest(step), await proofDigest(solution));
});
test('all real numbers and no solution denote True and False, not unbound variables', () => {
  assert.match(buildProof({ before: '2x=2x', after: 'all real numbers' }).statement, /↔ True$/);
  assert.match(buildProof({ before: '|x|=-1', after: 'no solution' }).statement, /↔ False$/);
});
test('a changed claim cannot reuse a previous digest', async () => {
  const correct = buildProof({ before: '|x-4|=3', after: 'x=1 or x=7' });
  const wrong = buildProof({ before: '|x-4|=3', after: 'x=7' });
  const constrained = buildProof({ before: '|x-4|=3', after: 'x=1 or x=7', constraints: ['x>4'] });
  const digests = await Promise.all([correct, wrong, constrained].map(proofDigest));
  assert.equal(new Set(digests).size, 3);
});
test('generates a candidate even for false claims, without claiming proof success', () => {
  assert.match(buildProof({ before: 'x=1', after: 'x=2' }).statement, /↔ \(v_x = \(2 : ℝ\)\)/);
});
for (const after of [
  'x=1/0',
  'x=1/(2-2)',
  'x=1/x',
  'x=x*x',
  'x=2^2',
  'x==2',
  'x=1; axiom oops : False',
  'x=1\n#eval IO.println "hi"',
  'x=1 -- trust me',
  'x=sorry',
  'x=| |x| |',
  'x=1000000000000',
  'x=' + '('.repeat(40) + '1' + ')'.repeat(40),
])
  test(`rejects unsupported or executable input: ${after.slice(0, 50)}`, () => {
    assert.throws(() => buildProof({ before: 'x=1', after }));
  });
test('checks numeric denominator operations before invoking Lean', () => {
  assert.doesNotThrow(() => buildProof({ before: 'x/(2-3)=1', after: 'x=-1' }));
  assert.throws(() => buildProof({ before: 'x/(0*(1/0))=1', after: 'x=1' }));
});
test('axiom audit accepts ordinary mathematical foundations', () => {
  assert.deepEqual(
    auditAxioms("'claim_0' depends on axioms: [propext, Classical.choice, Quot.sound]", 'claim_0'),
    ['Classical.choice', 'Quot.sound', 'propext'],
  );
});
for (const bad of [
  "'claim_0' depends on axioms: [sorryAx]",
  "'claim_0' depends on axioms: [Lean.ofReduceBool]",
  "'claim_0' depends on axioms: [trustMe]",
  "'different_claim' depends on axioms: [propext]",
  'Process completed successfully',
  "'claim_0' depends on axioms: [propext]\n'claim_0' depends on axioms: [propext]",
])
  test(`does not issue a receipt for an unaudited proof: ${bad.slice(0, 65)}`, () =>
    assert.throws(() => auditAxioms(bad, 'claim_0')));
