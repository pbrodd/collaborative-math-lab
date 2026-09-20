import { build } from 'esbuild';
import { readFile, readdir } from 'node:fs/promises';
const bundled = await build({
  stdin: {
    contents:
      "export {validateDocument} from './lib/validation'; export {auditScenario} from './lib/model'; export {scenarioCatalog} from './scenarios/catalog';",
    loader: 'ts',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { validateDocument, auditScenario, scenarioCatalog } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
);
let errors = 0;
const ids = new Set();
for (const file of (await readdir('scenarios')).filter((f) => f.endsWith('.json'))) {
  try {
    const entry = JSON.parse(await readFile(`scenarios/${file}`, 'utf8'));
    if (
      entry.formatVersion !== 1 ||
      entry.license !== 'MIT' ||
      typeof entry.id !== 'string' ||
      !entry.title ||
      !entry.creator
    )
      throw new Error('Include formatVersion 1, id, title, creator, and MIT license.');
    if (ids.has(entry.id)) throw new Error('Duplicate catalog identifier.');
    ids.add(entry.id);
    validateDocument(entry.scenario);
    if (!scenarioCatalog.some((s) => s.id === entry.id))
      throw new Error('Register this scenario in catalog.ts.');
    for (const audit of auditScenario(entry.scenario)) {
      const task = entry.scenario.tasks.find((t) => t.id === audit.id);
      if (audit.kind === 'unsupported') throw new Error(`${task.role}: ${audit.description}`);
      if (audit.intended && !audit.intended.valid)
        throw new Error(`${task.role}: intended solution does not match`);
      if (audit.kind !== 'literal' && task.intent === 'unique' && audit.count !== 1)
        throw new Error(`${task.role}: expected one solution`);
      if (task.intent === 'none' && audit.count !== 0)
        throw new Error(`${task.role}: expected no solution`);
      if (task.intent === 'multiple' && audit.count !== null && audit.count < 2)
        throw new Error(`${task.role}: expected multiple solutions`);
    }
    console.log(
      `✓ ${file}: ${entry.scenario.tasks.length} tasks, structure and intended solutions checked`,
    );
  } catch (e) {
    errors++;
    console.error(`✗ ${file}: ${e.message}`);
  }
}
if (errors) process.exitCode = 1;
else console.log('All catalog scenarios passed.');
