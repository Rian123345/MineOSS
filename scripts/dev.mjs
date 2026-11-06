// Entwicklungsmodus: Client-Watcher (esbuild) + Server mit Auto-Neustart (tsx watch)
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const bin = (n) => path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${n}.cmd` : n);

const procs = [
  spawn(process.execPath, [path.join(root, 'scripts', 'build.mjs'), '--watch'], { stdio: 'inherit', cwd: root }),
  spawn(bin('tsx'), ['watch', '--clear-screen=false', '--disable-warning=ExperimentalWarning', 'server/index.ts'], {
    stdio: 'inherit', cwd: root, shell: process.platform === 'win32',
  }),
];

const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => { if (code) { console.error('[dev] Prozess beendet mit Code', code); stop(); } });
