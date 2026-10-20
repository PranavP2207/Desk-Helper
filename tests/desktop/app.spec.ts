import { test, expect, _electron } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const testRoot = path.join(root, '.local-data/desktop-tests');

async function launch(dir: string, clipboardText = 'https://example.com/deskhelper') {
  const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE;
  Object.assign(env, { DESKHELPER_TEST_MODE: '1', DESKHELPER_TEST_LIBRARY: '1', DESKHELPER_DATA_DIR: dir, DESKHELPER_TEST_CLIPBOARD: clipboardText });
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [root], cwd: root, env, timeout: 30_000 });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
  await expect(page.getByRole('heading', { name: 'Your mind, a little lighter.' })).toBeVisible();
  await expect(page.getByText('Opening your pocket…')).toHaveCount(0);
  return { app, page };
}

test('automatic clipboard history, notes, search, pin, copy, delete/undo and restart work through the desktop bridge', async () => {
  await mkdir(testRoot, { recursive: true });
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  const dir = await mkdtemp(path.join(testRoot, 'workflow-'));
  let application: ElectronApplication | undefined;
  try {
    let { app, page } = await launch(dir);
    application = app;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.getByRole('button', { name: /Save item/ })).toBeDisabled();
    await page.screenshot({ path: path.join(root, 'artifacts/empty-desktop.png') });

    await expect(page.getByTestId('item-card')).toHaveCount(1);
    await expect(page.getByTestId('item-card').getByRole('heading')).toHaveText('https://example.com/deskhelper');

    await page.keyboard.press('Control+n');
    await page.getByRole('textbox', { name: 'Note title', exact: true }).fill('Back to the desk');
    await page.getByRole('textbox', { name: 'Note content', exact: true }).fill('Compare walnut samples before choosing the finish.');
    await page.getByRole('combobox', { name: 'Keep duration', exact: true }).selectOption('forever');
    await page.getByRole('textbox', { name: 'Note content', exact: true }).focus();
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('item-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'Pin Back to the desk', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Unpin Back to the desk', exact: true })).toBeVisible();

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('textbox', { name: 'Search saved items' })).toBeFocused();
    await page.getByRole('textbox', { name: 'Search saved items' }).fill('WALNUT');
    await expect(page.getByTestId('item-card')).toHaveCount(1);
    await expect(page.getByTestId('item-card').getByRole('heading')).toHaveText('Back to the desk');
    await page.getByRole('textbox', { name: 'Search saved items' }).fill('not present anywhere');
    await expect(page.getByText('Nothing here matches that.')).toBeVisible();
    await page.locator('.search-bar').getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.getByRole('button', { name: 'Copy Back to the desk', exact: true }).click();
    await app.evaluate(async () => { await (globalThis as any).__deskhelperTesting.tick(); });
    await expect(page.getByTestId('item-card')).toHaveCount(2);

    await page.getByRole('button', { name: 'Delete Back to the desk', exact: true }).click();
    await expect(page.getByTestId('item-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByTestId('item-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'View Back to the desk', exact: true }).click();
    await expect(page.getByRole('dialog').locator('pre')).toHaveText('Compare walnut samples before choosing the finish.');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.screenshot({ path: path.join(root, 'artifacts/saved-desktop.png') });

    const disk = JSON.parse(await readFile(path.join(dir, 'shelf.json'), 'utf8'));
    expect(disk.items.find((item: { title: string }) => item.title === 'Back to the desk')).toMatchObject({ pinned: true, retention: 'forever', content: 'Compare walnut samples before choosing the finish.' });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
    expect(errors).toEqual([]);
    await app.close();
    application = undefined;

    ({ app, page } = await launch(dir));
    application = app;
    await expect(page.getByTestId('item-card')).toHaveCount(2);
    await page.getByRole('navigation', { name: 'Library' }).getByRole('button', { name: /Pinned/ }).click();
    await expect(page.getByTestId('item-card')).toHaveCount(1);
    await expect(page.getByTestId('item-card').getByRole('heading')).toHaveText('Back to the desk');
    await page.getByRole('navigation', { name: 'Library' }).getByRole('button', { name: /Links/ }).click();
    await expect(page.getByTestId('item-card')).toHaveCount(1);
    await expect(page.getByTestId('item-card').getByRole('heading')).toHaveText('https://example.com/deskhelper');
    await page.getByRole('button', { name: 'Settings & shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Make yourself at home' })).toBeVisible();
  } finally { await application?.close(); await rm(dir, { recursive: true, force: true }); }
});

test('empty clipboard errors are visible, saved HTML is inert, and the renderer is isolated', async () => {
  await mkdir(testRoot, { recursive: true });
  const dir = await mkdtemp(path.join(testRoot, 'boundaries-'));
  let app: ElectronApplication | undefined;
  try {
    const started = await launch(dir, '');
    app = started.app;
    const page = started.page;
    const empty = await page.evaluate(() => window.deskhelper!.capture('day'));
    expect(empty).toEqual({ ok: false, error: 'Copy some text or an image first.' });
    await expect(page.getByTestId('item-card')).toHaveCount(0);
    const payload = '<img src=x onerror="window.__unsafe = true">';
    await page.getByRole('textbox', { name: 'Text to save' }).fill(payload);
    await page.getByRole('button', { name: /Save item/ }).click();
    await expect(page.getByTestId('item-card').getByRole('heading')).toHaveText(payload);
    await expect(page.getByTestId('item-card').locator('img')).toHaveCount(0);
    const boundary = await page.evaluate(() => ({
      require: typeof (window as unknown as Record<string, unknown>).require,
      process: typeof (window as unknown as Record<string, unknown>).process,
      unsafe: (window as unknown as Record<string, unknown>).__unsafe ?? false,
      arbitraryIPC: 'ipcRenderer' in window,
    }));
    expect(boundary).toEqual({ require: 'undefined', process: 'undefined', unsafe: false, arbitraryIPC: false });
    await page.setViewportSize({ width: 760, height: 620 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(root, 'artifacts/narrow-desktop.png') });
  } finally { await app?.close(); await rm(dir, { recursive: true, force: true }); }
});

test('a damaged saved-data file is reported and remains intact after a save attempt', async () => {
  await mkdir(testRoot, { recursive: true });
  const dir = await mkdtemp(path.join(testRoot, 'damaged-'));
  const file = path.join(dir, 'shelf.json');
  let app: ElectronApplication | undefined;
  try {
    await writeFile(file, '{damaged original');
    const started = await launch(dir);
    app = started.app;
    await expect(started.page.getByRole('alert')).toContainText('original file has been preserved');
    await started.page.getByRole('textbox', { name: 'Text to save' }).fill('Do not replace my saved items');
    await started.page.getByRole('button', { name: /Save item/ }).click();
    await expect(started.page.getByRole('alert')).toContainText('original file has been preserved');
    expect(await readFile(file, 'utf8')).toBe('{damaged original');
  } finally { await app?.close(); await rm(dir, { recursive: true, force: true }); }
});
