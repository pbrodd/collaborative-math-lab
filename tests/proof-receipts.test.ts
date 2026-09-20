import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({
  stdin: {
    contents: "export * from './lib/formal'; export * from './lib/proof-receipts';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  platform: 'node',
  format: 'esm',
  bundle: true,
  write: false,
});
const { buildProof, proofDigest, findReceipt, LEAN_VERSION, MATHLIB_REVISION } = await import(
  'data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64')
);
test('matches a receipt only to the exact proof source, statement, versions and allowed axioms', async () => {
  const claim = buildProof({ before: '|x|=2', after: 'x=-2 or x=2' });
  const digest = await proofDigest(claim);
  const receipt = { id: 'test', digest, statement: claim.statement, axioms: ['propext'] };
  const report = { format: 1, lean: LEAN_VERSION, mathlib: MATHLIB_REVISION, claims: [receipt] };
  assert.equal(findReceipt(claim, digest, report), receipt);
  assert.equal(findReceipt(claim, digest, { ...report, lean: 'different' }), undefined);
  assert.equal(findReceipt(claim, digest, { ...report, mathlib: 'different' }), undefined);
  assert.equal(findReceipt(claim, digest, { ...report, format: 2 }), undefined);
  for (const patch of [{ digest: 'different' }, { statement: 'True' }, { axioms: ['sorryAx'] }]) {
    assert.equal(
      findReceipt(claim, digest, { ...report, claims: [{ ...receipt, ...patch }] }),
      undefined,
    );
  }
  const changed = buildProof({ before: '|x|=2', after: 'x=2' });
  assert.equal(findReceipt(changed, await proofDigest(changed), report), undefined);
});
