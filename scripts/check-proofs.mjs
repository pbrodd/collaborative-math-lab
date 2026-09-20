import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { proofModules, proofCorpus } from './proof-corpus.mjs';
import { auditAxioms } from './lean-audit.mjs';

const run = promisify(execFile);
const modules = await proofModules();
const { buildProof, proofDigest, proofDeclaration, LEAN_HEADER, LEAN_VERSION, MATHLIB_REVISION } =
  modules;
const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
const verifyInput = inputIndex >= 0;
if (
  args.some(
    (s, i) =>
      !['--write-receipts', '--input'].includes(s) && !(inputIndex >= 0 && i === inputIndex + 1),
  )
)
  throw new Error('Use --write-receipts or --input request.json.');
const { claims, skipped } = verifyInput
  ? {
      claims: [
        { id: 'your-claim', request: JSON.parse(await readFile(args[inputIndex + 1], 'utf8')) },
      ],
      skipped: [],
    }
  : await proofCorpus(modules);
await mkdir('verification/generated', { recursive: true });
const cwd = new URL('../verification/', import.meta.url);
const lean = async (file) =>
  run('lake', ['env', 'lean', file], { cwd, timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
const version = await run('lake', ['env', 'lean', '--version'], { cwd, timeout: 120000 });
if (!version.stdout.includes(`version ${LEAN_VERSION},`))
  throw new Error(`Install the pinned Lean ${LEAN_VERSION} toolchain.`);
const manifest = JSON.parse(await readFile(new URL('lake-manifest.json', cwd), 'utf8'));
if (manifest.packages.find((p) => p.name === 'mathlib')?.rev !== MATHLIB_REVISION)
  throw new Error('The Mathlib revision does not match the proof configuration.');

const prepared = await Promise.all(
  claims.map(async ({ id, request }, i) => {
    const claim = buildProof(request);
    return { id, claim, theorem: `claim_${i}`, digest: await proofDigest(claim) };
  }),
);
const source =
  LEAN_HEADER + prepared.map((p) => proofDeclaration(p.claim.statement, p.theorem)).join('\n');
await writeFile('verification/generated/Claims.lean', source);
let output;
try {
  output = (await lean('generated/Claims.lean')).stdout;
} catch (error) {
  console.error(error.stdout || error.message);
  throw new Error(
    'Lean did not verify the claims. No new receipts were issued. A failure is not itself a proof of falsehood.',
  );
}
const receipts = prepared.map((p) => ({
  id: p.id,
  digest: p.digest,
  statement: p.claim.statement,
  axioms: auditAxioms(output, p.theorem),
}));

if (!verifyInput) {
  // Reject plausible but false candidates, independently of the app's checker.
  const invalid = [
    ['3|x-4|+2=11', 'x=7'],
    ['-2x<4', 'x<-2'],
    ['d=1800+200u', 'u=d-1800/200'],
    ['x=2', 'all real numbers'],
    ['x<2', 'x<=2'],
    ['x=2', 'y=2'],
  ];
  for (let i = 0; i < invalid.length; i++) {
    const [before, after] = invalid[i];
    await writeFile(
      `verification/generated/Rejected${i}.lean`,
      buildProof({ before, after }).source,
    );
    let rejected = false;
    try {
      await lean(`generated/Rejected${i}.lean`);
    } catch (error) {
      if (error.killed || typeof error.code !== 'number') throw error;
      if (!String(error.stdout).includes('error:')) throw error;
      rejected = true;
    }
    if (!rejected) throw new Error(`Lean unexpectedly accepted ${before} ↔ ${after}.`);
  }
  const existing = JSON.parse(await readFile('verification/receipts.json', 'utf8'));
  if (!args.includes('--write-receipts')) {
    if (
      existing.format !== 1 ||
      existing.lean !== LEAN_VERSION ||
      existing.mathlib !== MATHLIB_REVISION
    )
      throw new Error('Bundled receipt versions are stale. Regenerate receipts.');
    for (const receipt of existing.claims) {
      if (
        !receipts.some(
          (r) =>
            r.digest === receipt.digest &&
            r.statement === receipt.statement &&
            JSON.stringify(r.axioms) === JSON.stringify(receipt.axioms),
        )
      )
        throw new Error(
          `Bundled receipt ${receipt.id} was not reproduced by Lean. Regenerate receipts.`,
        );
    }
  }
}
const report = { format: 1, lean: LEAN_VERSION, mathlib: MATHLIB_REVISION, claims: receipts };
await writeFile('verification/generated/receipts.json', JSON.stringify(report, null, 2) + '\n');
if (args.includes('--write-receipts') && !verifyInput)
  await writeFile('verification/receipts.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('verification/generated/axioms.txt', output);
console.log(
  `Lean ${LEAN_VERSION} verified ${receipts.length} real-number equivalences; every proof passed the axiom audit.`,
);
if (!verifyInput) console.log('Six deliberately false candidates were rejected.');
if (skipped.length) console.log(`Open investigations (not certified): ${skipped.join(', ')}`);
