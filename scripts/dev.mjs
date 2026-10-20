import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';

const compile = spawn(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.electron.json'], { stdio: 'inherit', windowsHide: true });
await new Promise((resolve, reject) => {
  compile.on('error', reject);
  compile.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Desktop compilation failed.')));
});
await import('./copy-assets.mjs');
const server = await createServer();
await server.listen();
const env = { ...process.env, DESKHELPER_DEV_URL: 'http://127.0.0.1:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { env, stdio: 'inherit', windowsHide: true });
const close = async () => { child.kill(); await server.close(); };
child.on('exit', async (code) => { await server.close(); process.exitCode = code ?? 1; });
child.on('error', async (error) => { console.error(error.message); await server.close(); process.exitCode = 1; });
process.on('SIGINT', close);
process.on('SIGTERM', close);
