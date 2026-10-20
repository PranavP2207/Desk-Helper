import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist-electron/electron', { recursive: true });
await copyFile('electron/preload.cjs', 'dist-electron/electron/preload.cjs');
