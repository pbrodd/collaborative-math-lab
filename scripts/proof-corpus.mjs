import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

export async function proofModules() {
  const compiled = await build({
    stdin: { contents: "export * from './lib/formal'; export {scenarioValues,resolveTask} from './lib/model'; export {scenarioCatalog} from './scenarios/catalog';", loader: 'ts', resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'esm',
  });
  return import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
}
export async function proofCorpus(modules) {
  const examples = JSON.parse(await readFile('verification/examples.json', 'utf8'));
  const claims = examples.map(e => ({ id: `example:${e.id}`, request: e }));
  const skipped = [];
  for (const entry of modules.scenarioCatalog) {
    const values = modules.scenarioValues(entry.scenario, [], true);
    for (const task of entry.scenario.tasks) {
      const resolved = modules.resolveTask(task, values);
      const id = `scenario:${entry.id}:${task.id}`;
      if (!resolved.equation.trim()) { skipped.push(id); continue; }
      if (!resolved.intended.trim()) throw new Error(`${id} needs an intended solution for Lean to verify.`);
      claims.push({ id, request: { before: resolved.equation, after: resolved.intended, constraints: resolved.constraints, kind: 'solution' } });
    }
  }
  return { claims, skipped };
}
