// Normal-mode startup/shortcut check with a paused, isolated shelf. Never reads the OS clipboard.
import { _electron } from '@playwright/test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(), base = path.join(root, '.local-data/desktop-tests');
await mkdir(base, { recursive: true }); const directory = await mkdtemp(path.join(base, 'normal-smoke-'));
let application;
try {
  await writeFile(path.join(directory, 'shelf.json'), JSON.stringify({ version: 2, items: [], pockets: [], queue: [], trash: [], monitoring: false }));
  const env = { ...process.env, DESKHELPER_DATA_DIR: directory };
  delete env.ELECTRON_RUN_AS_NODE; delete env.DESKHELPER_TEST_MODE; delete env.DESKHELPER_TEST_LIBRARY; delete env.DESKHELPER_TEST_CLIPBOARD; delete env.DESKHELPER_DEV_URL;
  application = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [root], cwd: root, env });
  const page = await application.firstWindow();
  await page.getByRole('button', { name: 'Open corner pocket', exact: true }).waitFor();
  const result = await page.evaluate(async () => ({ info: await window.deskhelper.info(), state: await window.deskhelper.widgetState(), shelf: await window.deskhelper.list() }));
  if (!result.info.ok || !result.state.ok || !result.shelf.ok || result.state.value.expanded || result.shelf.value.monitoring || application.windows().length !== 1) throw new Error('Normal-mode startup check failed.');
  console.log(JSON.stringify({ version: result.info.value.version, shortcut: result.info.value.shortcutAvailable, cursorShortcut: result.info.value.cursorShortcutAvailable, queueShortcut: result.info.value.queueShortcutAvailable, expandedAtStartup: result.state.value.expanded, windows: application.windows().length, monitoring: result.shelf.value.monitoring }));
} finally { await application?.close(); await rm(directory, { recursive: true, force: true }); }
