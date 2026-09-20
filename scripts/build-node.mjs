import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Avoid mixing a previous Worker build with the standalone Node output.
rmSync('dist', { recursive: true, force: true });
const result = spawnSync(process.execPath, ['node_modules/vinext/dist/cli.js', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, LAB_RUNTIME: 'node' },
});
process.exit(result.status ?? 1);
