import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Both targets write dist/. Never package stale files from the other runtime.
rmSync('dist', { recursive: true, force: true });
const result = spawnSync(process.execPath, ['node_modules/vinext/dist/cli.js', 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    LAB_RUNTIME: process.argv[2] === 'node' ? 'node' : 'workers',
    WRANGLER_LOG_PATH: '.wrangler/wrangler.log',
  },
});
process.exit(result.status ?? 1);
