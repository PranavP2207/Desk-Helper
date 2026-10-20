import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, net, Notification, protocol, screen, Tray } from 'electron';
import type { BrowserWindowConstructorOptions, IpcMainInvokeEvent, IpcMainEvent } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { ShelfStore } from '../core/store.js';
import { ImageStore } from '../core/images.js';
import { emptySnapshot, validId, validRetention } from '../core/model.js';
import type { Cleanup, Result, ShelfItem, Snapshot } from '../core/model.js';
import { cleanText } from '../core/cleanup.js';
import { ClipboardWatcher } from '../core/clipboard-watcher.js';
import type { ClipboardContents } from '../core/clipboard-watcher.js';
import { cornerBounds, cursorBounds, Proximity, validCorner } from '../core/widget.js';
import type { Corner, WidgetState } from '../core/widget.js';
import { clipboardPort } from './clipboard.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const uiRoot = path.join(root, 'dist');
const testing = !app.isPackaged && process.env.DESKHELPER_TEST_MODE === '1';
const testLibrary = testing && process.env.DESKHELPER_TEST_LIBRARY === '1';
const devURL = !app.isPackaged && process.env.DESKHELPER_DEV_URL === 'http://127.0.0.1:5173' ? 'http://127.0.0.1:5173' : null;
type Surface = 'library' | 'widget';
const pageURL = (surface: Surface) => `${devURL ? `${devURL}/` : 'app://deskhelper/index.html'}?surface=${surface}`;
app.setName('DeskHelper');
app.setAppUserModelId('DeskHelper');
const dataDirectory = !app.isPackaged ? path.resolve(process.env.DESKHELPER_DATA_DIR ?? path.join(root, '.local-data/user')) : path.join(app.getPath('appData'), 'DeskHelper');
mkdirSync(dataDirectory, { recursive: true });
app.setPath('userData', dataDirectory);
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const store = new ShelfStore(path.join(dataDirectory, 'shelf.json'), () => Date.now());
const images = new ImageStore(path.join(dataDirectory, 'images'), store);
const clip = clipboardPort(testing, process.env.DESKHELPER_TEST_CLIPBOARD ?? '');
const trusted = new Map<number, { window: BrowserWindow; surface: Surface; url: string }>();
const proximity = new Proximity();
let latest = emptySnapshot();
let library: BrowserWindow | null = null, widget: BrowserWindow | null = null, tray: Tray | null = null;
let quitting = false, shortcutAvailable = false, cursorShortcutAvailable = false, queueShortcutAvailable = false;
let expanded = false, keepOpen = false, interacting = false, cooldown = 0;
let corner: Corner = 'bottom-right', displayId = '';
let cursorAnchor: { x: number; y: number } | null = null;
const timers: ReturnType<typeof setInterval>[] = [];
const notifications = new Set<Notification>();
let reminderBusy = false;
let monitoringTransition = false;
let trayMenu: Menu | null = null;
function icon() {
  const size = 64, pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, distance = Math.hypot(x - 31.5, y - 31.5);
    const face = Math.hypot(x - 23, y - 28) < 3 || Math.hypot(x - 40, y - 28) < 3 || (y >= 38 && y <= 41 && x >= 26 && x <= 37);
    pixels[i] = face ? 255 : 235; pixels[i + 1] = face ? 255 : 132; pixels[i + 2] = face ? 255 : 53;
    pixels[i + 3] = Math.round(Math.min(1, Math.max(0, 29 - distance)) * 255);
  }
  return nativeImage.createFromBitmap(pixels, { width: size, height: size });
}
function state(): WidgetState { return { expanded, keepOpen, nearCursor: !!cursorAnchor, corner, displayId, displays: screen.getAllDisplays().map((display, index) => ({ id: String(display.id), label: display.label || `Display ${index + 1}` })) }; }
function stateChanged() { widget?.webContents.send('deskhelper:widget-state', state()); }
function changed(snapshot: Snapshot) { latest = snapshot; const menuItem = trayMenu?.getMenuItemById('monitor'); if (menuItem) menuItem.checked = snapshot.monitoring; for (const entry of trusted.values()) entry.window.webContents.send('deskhelper:changed', snapshot); }
function place() {
  if (!widget) return;
  const display = cursorAnchor ? screen.getDisplayNearestPoint(cursorAnchor) : screen.getAllDisplays().find((display) => String(display.id) === displayId) ?? screen.getPrimaryDisplay();
  if (!cursorAnchor) displayId = String(display.id);
  widget.setBounds(cursorAnchor && expanded ? cursorBounds(display.workArea, cursorAnchor) : cornerBounds(display.workArea, corner, expanded)); stateChanged();
}
function expand(focus = false, nearCursor = false) {
  if (!widget) return;
  if (nearCursor) cursorAnchor = screen.getCursorScreenPoint();
  expanded = true; proximity.reset(); place(); widget.setFocusable(focus);
  if (focus) { widget.show(); widget.focus(); widget.webContents.send('deskhelper:focus-search'); } else widget.showInactive();
}
function collapse() { if (!widget) return; expanded = false; keepOpen = false; cursorAnchor = null; cooldown = Date.now() + 1200; proximity.reset(); widget.blur(); widget.setFocusable(false); place(); }
function hideWidget() { collapse(); widget?.hide(); proximity.reset(); }
function createSurface(surface: Surface, options: BrowserWindowConstructorOptions): BrowserWindow {
  const window = new BrowserWindow({ show: false, icon: icon(), autoHideMenuBar: true, ...options, webPreferences: { preload: path.join(root, 'dist-electron/electron/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  trusted.set(window.webContents.id, { window, surface, url: pageURL(surface) });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  const sender = window.webContents.id; window.on('closed', () => trusted.delete(sender)); return window;
}
async function load(window: BrowserWindow) { await window.loadURL(trusted.get(window.webContents.id)!.url); }
async function openLibrary() {
  if (!library || library.isDestroyed()) {
    library = createSurface('library', { title: 'DeskHelper Library', width: 1100, height: 800, minWidth: 760, minHeight: 620, backgroundColor: '#f7f9fc', titleBarStyle: 'hidden', titleBarOverlay: { color: '#f4f6fa', symbolColor: '#677287', height: 38 } });
    library.on('close', (event) => { if (!quitting) { event.preventDefault(); library?.hide(); } }); await load(library);
  }
  if (library.isMinimized()) library.restore(); library.show(); library.focus(); library.webContents.send('deskhelper:focus-search');
}
function checkSender(event: IpcMainInvokeEvent | IpcMainEvent, roles: Surface[] = ['widget', 'library']) {
  const entry = trusted.get(event.sender.id);
  if (!entry || event.senderFrame !== entry.window.webContents.mainFrame || event.senderFrame.url !== entry.url || !roles.includes(entry.surface)) throw new Error('This request is not available.'); return entry;
}
function handle<T>(channel: string, action: (value: any, event: IpcMainInvokeEvent) => Promise<T> | T, roles: Surface[] = ['widget', 'library']) {
  ipcMain.handle(`deskhelper:${channel}`, async (event, value): Promise<Result<T>> => { try { checkSender(event, roles); return { ok: true, value: await action(value, event) }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' }; } });
}
function report(error: unknown) { widget?.webContents.send('deskhelper:error', error instanceof Error ? error.message : 'That action could not finish.'); }
async function capture(contents: ClipboardContents, hash?: string, keep: unknown = 'day') {
  const retention = validRetention(keep);
  if (contents.excluded) throw new Error('This clipboard item is marked private by its source app.');
  if (contents.image) {
    const image = nativeImage.createFromBuffer(contents.image); if (image.isEmpty()) throw new Error('The clipboard image could not be read.');
    return images.save(image.toPNG(), image.getSize(), `Clipboard image · ${new Date().toLocaleString()}`, retention, hash);
  }
  if (!contents.text.trim()) throw new Error('Copy some text or an image first.');
  return hash ? store.captureText(contents.text, hash) : store.save({ content: contents.text, kind: 'text', retention });
}
const watcher = new ClipboardWatcher(() => clip.read(), async (contents, hash) => { changed(await capture(contents, hash)); }, () => latest.monitoring && !monitoringTransition, report);
async function setMonitoring(value: boolean) { monitoringTransition = true; watcher.invalidate(); try { const snapshot = await store.setMonitoring(value); changed(snapshot); return snapshot; } finally { monitoringTransition = false; watcher.invalidate(); } }
async function copyItem(item: ShelfItem) {
  const contents = item.image ? { text: '', image: await images.read(item.image.id) } : { text: item.content };
  watcher.suppress(contents);
  try { if (contents.image) await clip.writeImage(contents.image); else await clip.writeText(contents.text); }
  catch (error) { watcher.invalidate(); throw error; }
}
async function copyNext() {
  const snapshot = await store.list(), item = snapshot.items.find((item) => item.id === snapshot.queue[0]);
  if (!item) throw new Error('Add some items to the paste queue first.');
  await copyItem(item); const next = await store.advanceQueue(item.id); changed(next); collapse(); return next;
}
async function reminders() {
  if (reminderBusy) return; reminderBusy = true;
  try {
    const before = new Set(latest.items.filter((item) => item.remindedAt).map((item) => item.id));
    const snapshot = await store.claimReminders(); changed(snapshot);
    for (const item of snapshot.items.filter((item) => item.remindedAt && !before.has(item.id))) {
      if (!testing && Notification.isSupported()) {
        const notification = new Notification({ title: `DeskHelper · ${item.title}`, body: item.image ? 'Your saved image is ready to revisit.' : item.content.slice(0, 180), icon: item.image ? images.path(item.image.id) : icon(), silent: false });
        notifications.add(notification); notification.on('close', () => notifications.delete(notification));
        notification.on('click', () => { expand(true); widget?.webContents.send('deskhelper:reminder', item.id); }); notification.show();
      }
    }
  } catch (error) { report(error); } finally { reminderBusy = false; }
}
async function initialize() {
  Menu.setApplicationMenu(null);
  protocol.handle('app', async (request) => {
    const url = new URL(request.url); if (url.hostname !== 'deskhelper') return new Response('Not found', { status: 404 });
    const image = /^\/images\/([\da-f-]{36})\.png$/i.exec(url.pathname);
    if (image) { try { return new Response(new Uint8Array(await images.read(image[1])), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } }); } catch { return new Response('Image unavailable', { status: 404 }); } }
    let file: string; try { file = path.resolve(uiRoot, `.${decodeURIComponent(url.pathname)}`); } catch { return new Response('Not found', { status: 404 }); }
    const relative = path.relative(uiRoot, file); if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Not found', { status: 404 }); return net.fetch(pathToFileURL(file).href);
  });
  let startupError: unknown;
  try { latest = await store.list(); } catch (error) { latest.monitoring = false; startupError = error; }
  watcher.seed(latest.clipboardFingerprint);
  try { const placement = JSON.parse(await readFile(path.join(dataDirectory, 'widget.json'), 'utf8')); corner = validCorner(placement.corner); displayId = typeof placement.displayId === 'string' ? placement.displayId : ''; } catch { /* Use the primary screen if placement is absent or invalid. */ }
  const mutate = (name: string, action: (value: any) => Promise<Snapshot>) => handle(name, async (value) => { const snapshot = await action(value); changed(snapshot); return snapshot; });
  handle('list', () => store.list());
  mutate('save', (value) => store.save(value));
  mutate('capture', async (keep) => capture(await clip.read(), undefined, keep));
  mutate('pin', (value) => store.pin(validId(value))); mutate('remove', (value) => store.remove(validId(value))); mutate('undo', () => store.undo());
  mutate('monitoring', setMonitoring);
  mutate('pocket-create', (value) => store.createPocket(value));
  mutate('pocket-rename', (value) => store.renamePocket(validId(value?.id), value?.name));
  mutate('pocket-delete', (value) => store.deletePocket(validId(value)));
  mutate('pocket-assign', (value) => store.assignPocket(validId(value?.id), value?.pocketId === null ? null : validId(value?.pocketId)));
  mutate('queue-toggle', (value) => store.toggleQueue(validId(value)));
  mutate('queue-move', (value) => store.moveQueue(validId(value?.id), value?.direction));
  handle('queue-next', copyNext);
  mutate('remind', (value) => store.remind(validId(value?.id), value?.at));
  mutate('reminder-ack', (value) => store.acknowledgeReminder(validId(value)));
  mutate('restore', (value) => store.restore(validId(value)));
  mutate('purge', async (value) => { const snapshot = await store.purge(validId(value)); await images.clean(); return snapshot; });
  mutate('clean', async (value) => {
    const item = (await store.list()).items.find((item) => item.id === validId(value?.id));
    if (!item || item.image) throw new Error('Choose a saved text item.');
    const content = cleanText(item.content, value?.operation as Cleanup);
    if (value?.action === 'copy') { watcher.suppress({ text: content }); await clip.writeText(content); collapse(); return store.list(); }
    if (value?.action !== 'save') throw new Error('Choose copy or save.');
    return store.save({ content, kind: item.kind === 'note' ? 'note' : 'text', retention: item.retention, pocketId: item.pocketId });
  });
  handle('copy', async (value) => {
    const item = (await store.list()).items.find((item) => item.id === validId(value?.id)); if (!item) throw new Error('This item has expired or was removed.');
    await copyItem(item); if (value?.tuck === true) collapse(); return null;
  });
  ipcMain.on('deskhelper:drag', (event, value) => {
    try {
      checkSender(event); const item = latest.items.find((item) => item.id === validId(value));
      if (!item?.image) throw new Error('Only saved images can be dragged out.');
      images.lease(item.image.id);
      event.sender.startDrag({ file: images.path(item.image.id), icon: nativeImage.createFromPath(images.path(item.image.id)).resize({ width: 96 }) });
    } catch (error) { report(error); }
  });
  handle('hide', (_value, event) => { checkSender(event).window.hide(); return null; });
  handle('quit', () => { setImmediate(() => app.quit()); return null; });
  handle('info', () => ({ shortcut: 'Ctrl + Shift + Space', shortcutAvailable, cursorShortcutAvailable, queueShortcutAvailable, version: app.getVersion() }));
  handle('widget-state', state);
  handle('widget-expand', (near) => { expand(true, near === true); return null; });
  handle('widget-collapse', () => { collapse(); return null; }, ['widget']);
  handle('widget-hide', () => { hideWidget(); return null; }, ['widget']);
  handle('widget-activity', (value) => { if (typeof value !== 'boolean') throw new Error('Invalid activity state.'); interacting = value; return null; }, ['widget']);
  handle('widget-interact', () => { widget?.setFocusable(true); widget?.focus(); return null; }, ['widget']);
  handle('widget-keep', (value) => { if (typeof value !== 'boolean') throw new Error('Invalid keep-open state.'); keepOpen = value; stateChanged(); return state(); }, ['widget']);
  handle('widget-position', async (value) => {
    const nextCorner = validCorner(value?.corner);
    if (typeof value?.displayId !== 'string' || !screen.getAllDisplays().some((display) => String(display.id) === value.displayId)) throw new Error('This screen is no longer connected.');
    await writeFile(path.join(dataDirectory, 'widget.json.tmp'), JSON.stringify({ corner: nextCorner, displayId: value.displayId }));
    await rename(path.join(dataDirectory, 'widget.json.tmp'), path.join(dataDirectory, 'widget.json'));
    corner = nextCorner; displayId = value.displayId; cursorAnchor = null; proximity.reset(); place(); return state();
  }, ['widget']);
  handle('open-library', async () => { await openLibrary(); return null; });
  if (!testing) {
    shortcutAvailable = globalShortcut.register('Control+Shift+Space', () => { if (expanded && widget?.isVisible() && widget.isFocused()) collapse(); else expand(true); });
    cursorShortcutAvailable = globalShortcut.register('Control+Alt+Space', () => expand(true, true));
    queueShortcutAvailable = globalShortcut.register('Control+Alt+V', () => { void copyNext().catch(report); });
  }
  if (testLibrary) await openLibrary();
  widget = createSurface('widget', { width: 64, height: 64, frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, movable: false, skipTaskbar: true, alwaysOnTop: true, focusable: false, hasShadow: false, title: 'DeskHelper Corner' });
  widget.on('close', (event) => { if (!quitting) { event.preventDefault(); hideWidget(); } });
  widget.webContents.on('context-menu', () => tray?.popUpContextMenu());
  place(); await load(widget); widget.showInactive();
  if (startupError) report(startupError);
  screen.on('display-added', place); screen.on('display-removed', place); screen.on('display-metrics-changed', place);
  tray = new Tray(icon().resize({ width: 20, height: 20 })); tray.setToolTip('DeskHelper · Your corner pocket');
  trayMenu = Menu.buildFromTemplate([
    { label: 'Open corner pocket', click: () => expand(true) }, { label: 'Summon beside cursor', click: () => expand(true, true) },
    { label: 'Hide floating dot', click: hideWidget }, { label: 'Open library', click: () => { void openLibrary().catch(report); } },
    { type: 'separator' }, { id: 'monitor', label: 'Clipboard history', type: 'checkbox', checked: latest.monitoring, click: (item) => { void setMonitoring(item.checked).catch(report); } },
    { label: 'Copy next queued item', click: () => { void copyNext().catch(report); } }, { type: 'separator' }, { label: 'Quit DeskHelper', click: () => app.quit() },
  ]); tray.setContextMenu(trayMenu);
  tray.on('click', () => expand(true));
  timers.push(setInterval(() => {
    if (!widget?.isVisible() || Date.now() < cooldown) return;
    const action = proximity.tick(Date.now(), screen.getCursorScreenPoint(), widget.getBounds(), expanded, keepOpen || interacting || widget.isFocused());
    if (action === 'expand') expand(); else if (action === 'collapse') collapse();
  }, 120));
  timers.push(setInterval(() => { void watcher.tick(); }, 750));
  timers.push(setInterval(() => { void reminders(); }, 1000));
  timers.push(setInterval(() => { void images.clean().then(() => store.list()).then(changed).catch(report); }, 60_000));
  for (const timer of timers) timer.unref();
  if (testing) Object.assign(globalThis, { __deskhelperTesting: { inject: clip.inject, readClipboard: clip.read, tick: () => watcher.tick(), reminders, store, images } });
  void watcher.tick(); void reminders(); void images.clean().catch(report);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => expand(true));
  app.whenReady().then(initialize).catch(() => { console.error('DeskHelper could not start. Check the installation and data-folder permissions.'); app.exit(1); });
  app.on('activate', () => expand(true));
}
app.on('before-quit', () => { quitting = true; for (const timer of timers) clearInterval(timer); for (const notification of notifications) notification.close(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });
