import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const build = spawnSync(process.execPath, ['scripts/build.mjs', 'node'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const directory = mkdtempSync(join(tmpdir(), 'mathlab-browser-'));
const app = spawn(process.execPath, ['dist/standalone/server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: '3108',
    DATABASE_PATH: join(directory, 'test.sqlite'),
    APP_ORIGIN: 'http://127.0.0.1:3108',
    AUTH_SETUP_TOKEN: 'browser-only-disposable-server-setup-secret',
  },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => app.kill(signal));
app.on('exit', (code) => {
  rmSync(directory, { recursive: true, force: true });
  process.exit(code ?? 0);
});
