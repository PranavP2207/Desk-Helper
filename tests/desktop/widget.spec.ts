import { test, expect, _electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(), testRoot = path.join(root, '.local-data/desktop-tests');
async function launch(dir: string, clipboardText = 'https://example.com/corner-pocket') {
  const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE; delete env.DESKHELPER_TEST_LIBRARY; delete env.DESKHELPER_DEV_URL;
  Object.assign(env, { DESKHELPER_TEST_MODE: '1', DESKHELPER_DATA_DIR: dir, DESKHELPER_TEST_CLIPBOARD: clipboardText });
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [root], cwd: root, env });
  const page = await app.firstWindow();
  await expect(page.getByRole('button', { name: 'Open corner pocket', exact: true })).toBeVisible();
  await app.evaluate(({ screen }) => { screen.getCursorScreenPoint = () => ({ x: -99999, y: -99999 }); });
  return { app, page };
}
async function fixture() { await mkdir(testRoot, { recursive: true }); await mkdir(path.join(root, 'artifacts'), { recursive: true }); return mkdtemp(path.join(testRoot, 'corner-')); }
async function open(page: Page) { await page.getByRole('button', { name: 'Open corner pocket', exact: true }).click(); }
async function note(page: Page, content: string) { await page.getByRole('button', { name: 'Quick note', exact: true }).click(); await page.getByRole('textbox', { name: 'Quick note content' }).fill(content); await page.getByRole('button', { name: 'Save note', exact: true }).click(); }

test('dot hover, draft protection, copy-and-tuck, optional library and saved-corner behavior', async () => {
  const dir = await fixture(); let application: ElectronApplication | undefined;
  try {
    let { app, page } = await launch(dir); application = app;
    expect(app.windows()).toHaveLength(1);
    const resting = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { width: w.getBounds().width, focusable: w.isFocusable(), top: w.isAlwaysOnTop() }; });
    expect(Math.abs(resting.width - 64)).toBeLessThanOrEqual(1); expect(resting.focusable).toBe(false); expect(resting.top).toBe(true);
    await page.screenshot({ path: path.join(root, 'artifacts/corner-dot.png') });
    await app.evaluate(({ screen, BrowserWindow }) => { const bounds = BrowserWindow.getAllWindows()[0].getBounds(); screen.getCursorScreenPoint = () => ({ x: bounds.x + 32, y: bounds.y + 32 }); });
    await expect(page.getByRole('region', { name: 'Corner pocket' })).toBeVisible();
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFocusable())).toBe(false);
    await app.evaluate(({ screen }) => { screen.getCursorScreenPoint = () => ({ x: -99999, y: -99999 }); });
    await expect(page.getByRole('region', { name: 'Corner pocket' })).toHaveCount(0);
    await open(page); await expect(page.getByTestId('pocket-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'Quick note', exact: true }).click(); await page.getByRole('textbox', { name: 'Quick note content' }).fill('Return to the corner flow');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].blur()); await page.waitForTimeout(1200);
    await expect(page.getByRole('textbox', { name: 'Quick note content' })).toHaveValue('Return to the corner flow');
    await page.getByRole('button', { name: 'Save note', exact: true }).click(); await expect(page.getByTestId('pocket-item')).toHaveCount(2);
    await page.getByRole('button', { name: 'Details Return to the corner flow', exact: true }).click();
    await page.getByRole('button', { name: 'Pin', exact: true }).click(); await page.getByRole('button', { name: 'Back to items' }).click();
    await page.getByRole('textbox', { name: 'Search pocket' }).fill('RETURN'); await expect(page.getByTestId('pocket-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'Copy and tuck Return to the corner flow', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Corner pocket' })).toHaveCount(0);
    expect(await app.evaluate(async () => (await (globalThis as any).__deskhelperTesting.readClipboard()).text)).toBe('Return to the corner flow');
    await open(page); await page.getByRole('button', { name: 'Clear pocket search' }).click();
    const nextWindow = app.waitForEvent('window'); await page.getByRole('button', { name: /Open library/ }).click(); const library = await nextWindow;
    await expect(library.getByTestId('item-card')).toHaveCount(2);
    await library.getByRole('button', { name: 'Delete Return to the corner flow', exact: true }).click(); await expect(page.getByTestId('pocket-item')).toHaveCount(1);
    await library.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByTestId('pocket-item')).toHaveCount(2);
    await page.getByRole('button', { name: 'Position settings', exact: true }).click(); await page.getByRole('button', { name: 'Top left', exact: true }).click();
    expect(JSON.parse(await readFile(path.join(dir, 'widget.json'), 'utf8')).corner).toBe('top-left');
    await app.close(); application = undefined; ({ app, page } = await launch(dir)); application = app;
    const bounds = await app.evaluate(({ BrowserWindow, screen }) => ({ window: BrowserWindow.getAllWindows()[0].getBounds(), work: screen.getPrimaryDisplay().workArea }));
    expect(Math.abs(bounds.window.x - bounds.work.x - 14)).toBeLessThanOrEqual(1); expect(Math.abs(bounds.window.y - bounds.work.y - 14)).toBeLessThanOrEqual(1);
    await open(page); await page.getByRole('button', { name: 'Pinned', exact: true }).click(); await expect(page.getByTestId('pocket-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'Hide widget to tray' }).click(); expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
  } finally { await application?.close(); await rm(dir, { recursive: true, force: true }); }
});

test('live history updates text and images, pause persists, images drag as native files and app copies do not duplicate', async () => {
  const dir = await fixture(); let app: ElectronApplication | undefined;
  try {
    const started = await launch(dir, ''); app = started.app; const page = started.page; await open(page);
    await expect(page.getByRole('button', { name: /^Screenshot/ })).toHaveCount(0);
    await app.evaluate(() => (globalThis as any).__deskhelperTesting.inject({ text: 'external copy appears automatically' }));
    await expect(page.getByTestId('pocket-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'Pause clipboard history' }).click();
    await app.evaluate(async () => { const test = (globalThis as any).__deskhelperTesting; test.inject({ text: 'while paused' }); await test.tick(); });
    await expect(page.getByTestId('pocket-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'Resume clipboard history' }).click(); await expect(page.getByTestId('pocket-item')).toHaveCount(2);
    await app.evaluate(({ nativeImage }) => { const pixels = Buffer.alloc(40 * 30 * 4); for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 80; pixels[i + 1] = 120; pixels[i + 2] = 40; pixels[i + 3] = 255; } const png = nativeImage.createFromBitmap(pixels, { width: 40, height: 30 }).toPNG(); (globalThis as any).__deskhelperTesting.inject({ text: '', image: png }); });
    await expect(page.getByTestId('pocket-item')).toHaveCount(3); await page.getByRole('button', { name: 'Images', exact: true }).click();
    await expect(page.getByTestId('pocket-item')).toHaveCount(1); const image = page.getByTestId('pocket-item').locator('img');
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(40);
    await app.evaluate(({ BrowserWindow }) => { (globalThis as any).__dragged = null; BrowserWindow.getAllWindows()[0].webContents.startDrag = (item: any) => { (globalThis as any).__dragged = { file: item.file, iconEmpty: item.icon.isEmpty() }; }; });
    await image.dispatchEvent('dragstart');
    await expect.poll(() => app!.evaluate(() => (globalThis as any).__dragged)).not.toBeNull();
    const dragged = await app.evaluate(() => (globalThis as any).__dragged); expect(dragged.file.startsWith(path.join(dir, 'images'))).toBe(true); expect(dragged.iconEmpty).toBe(false);
    const png = await readFile(dragged.file); expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    await page.getByTestId('pocket-item').getByRole('button', { name: /^Copy and tuck/ }).click(); await open(page);
    await app.evaluate(async () => { await (globalThis as any).__deskhelperTesting.tick(); });
    await expect(page.getByTestId('pocket-item')).toHaveCount(1);
    await page.screenshot({ path: path.join(root, 'artifacts/corner-images.png') });
    await page.getByRole('button', { name: 'Pause clipboard history' }).click(); await app.close(); app = undefined;
    const reopened = await launch(dir, 'must stay paused'); app = reopened.app; await open(reopened.page);
    await expect(reopened.page.getByRole('button', { name: 'Resume clipboard history' })).toBeVisible(); await expect(reopened.page.getByTestId('pocket-item')).toHaveCount(3);
  } finally { await app?.close(); await rm(dir, { recursive: true, force: true }); }
});

test('task pockets, reordered paste queue, cleanup, reminders, recovery and cursor summon work in the compact panel', async () => {
  const dir = await fixture(); let app: ElectronApplication | undefined;
  try {
    const started = await launch(dir, ''); app = started.app; const page = started.page; await open(page);
    await page.getByRole('button', { name: 'Manage task pockets' }).click(); await page.getByRole('textbox', { name: 'Pocket name' }).fill('Research'); await page.getByRole('button', { name: 'Create', exact: true }).click(); await page.getByRole('button', { name: 'Back to items' }).click();
    await page.getByRole('combobox', { name: 'Task pocket filter' }).selectOption({ label: 'Research' });
    await note(page, '  first value  '); await note(page, 'second value'); await expect(page.getByTestId('pocket-item')).toHaveCount(2);
    await page.getByRole('button', { name: 'Add to queue first value', exact: true }).click(); await page.getByRole('button', { name: 'Add to queue second value', exact: true }).click();
    await page.getByRole('button', { name: /^Queue/ }).click(); await page.getByRole('button', { name: 'Move up second value', exact: true }).click();
    await expect(page.getByTestId('pocket-item').first().locator('strong')).toHaveText('second value');
    await page.getByRole('button', { name: 'Copy next', exact: true }).click(); await expect(page.getByRole('region', { name: 'Corner pocket' })).toHaveCount(0);
    expect(await app.evaluate(async () => (await (globalThis as any).__deskhelperTesting.readClipboard()).text)).toBe('second value');
    await open(page); await expect(page.getByTestId('pocket-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'Recent', exact: true }).click(); await page.getByRole('button', { name: 'Details first value', exact: true }).click();
    await page.getByRole('combobox', { name: 'Text cleanup action' }).selectOption('trim'); await expect(page.getByLabel('Cleaned text preview')).toHaveText('first value');
    await page.getByRole('button', { name: 'Copy clean & tuck', exact: true }).click(); await open(page);
    expect(await app.evaluate(async () => (await (globalThis as any).__deskhelperTesting.readClipboard()).text)).toBe('first value');
    await page.getByRole('button', { name: 'Save a cleaned copy', exact: true }).click();
    await page.getByRole('button', { name: 'In 15 min', exact: true }).click();
    await page.getByRole('button', { name: 'Back to items' }).click();
    await app.evaluate(async () => { const realNow = Date.now; Date.now = () => realNow() + 16 * 60_000; await (globalThis as any).__deskhelperTesting.reminders(); });
    await expect(page.locator('.reminder-banner')).toContainText('1 reminder ready'); await page.locator('.reminder-banner').getByRole('button').first().click(); await expect(page.getByText('Ready to revisit', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Back to items' }).click(); await page.getByRole('button', { name: 'Dismiss ready reminder' }).click();
    await page.screenshot({ path: path.join(root, 'artifacts/corner-populated.png') });
    await page.getByRole('button', { name: 'Delete second value', exact: true }).click(); await page.getByRole('button', { name: 'Deleted', exact: true }).click(); await expect(page.getByTestId('pocket-item')).toHaveCount(1);
    await app.close(); app = undefined; const reopened = await launch(dir, ''); app = reopened.app; const next = reopened.page; await open(next);
    await next.getByRole('button', { name: 'Deleted', exact: true }).click(); await next.getByRole('button', { name: 'Restore second value', exact: true }).click(); await expect(next.getByTestId('pocket-item')).toHaveCount(0);
    await next.getByRole('button', { name: 'Recent', exact: true }).click(); await expect(next.getByTestId('pocket-item')).toHaveCount(3);
    const saved = await next.evaluate(() => window.deskhelper!.widgetState());
    await app.evaluate(({ screen }) => { screen.getCursorScreenPoint = () => ({ x: 300, y: 200 }); });
    await next.getByRole('button', { name: 'Position settings' }).click(); await next.getByRole('button', { name: 'Summon beside cursor', exact: true }).click();
    expect((await next.evaluate(() => window.deskhelper!.widgetState()) as any).value.nearCursor).toBe(true);
    const near = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds()); expect(Math.abs(near.x - 312)).toBeLessThanOrEqual(1);
    await next.getByRole('button', { name: 'Collapse corner pocket', exact: true }).click();
    const tucked = await next.evaluate(() => window.deskhelper!.widgetState()); expect((tucked as any).value.nearCursor).toBe(false); expect((tucked as any).value.corner).toBe((saved as any).value.corner);
  } finally { await app?.close(); await rm(dir, { recursive: true, force: true }); }
});

test('a failed image copy leaves the next queue entry intact and reports the failure', async () => {
  const dir = await fixture(); let app: ElectronApplication | undefined;
  try {
    const started = await launch(dir, ''); app = started.app; const page = started.page; await open(page);
    const image = await app.evaluate(async ({ nativeImage }) => {
      const test = (globalThis as any).__deskhelperTesting;
      const png = nativeImage.createFromBitmap(Buffer.alloc(4 * 4 * 4, 255), { width: 4, height: 4 }).toPNG();
      const item = (await test.images.save(png, { width: 4, height: 4 }, 'missing image')).items[0];
      return { id: item.id, imageId: item.image.id };
    });
    await page.evaluate(async (id) => { await window.deskhelper!.queueToggle(id); }, image.id);
    await rm(path.join(dir, 'images', `${image.imageId}.png`));
    await page.getByRole('button', { name: /^Queue/ }).click(); await page.getByRole('button', { name: 'Copy next', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByTestId('pocket-item')).toHaveCount(1);
    const snapshot = await page.evaluate(() => window.deskhelper!.list()); expect((snapshot as any).value.queue).toEqual([image.id]);
  } finally { await app?.close(); await rm(dir, { recursive: true, force: true }); }
});
