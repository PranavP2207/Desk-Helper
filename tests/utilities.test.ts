import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ShelfStore } from '../core/store.js';
import { cleanText } from '../core/cleanup.js';
import { fingerprint } from '../core/clipboard-watcher.js';
const base = path.resolve('.local-data/unit'); await mkdir(base, { recursive: true });
async function fixture(t: test.TestContext) {
  const dir = await mkdtemp(path.join(base, 'utilities-')); t.after(() => rm(dir, { recursive: true, force: true }));
  let now = 1_800_000_000_000; const file = path.join(dir, 'shelf.json');
  return { file, store: new ShelfStore(file, () => now), advance: (ms: number) => { now += ms; }, reopen: () => new ShelfStore(file, () => now) };
}
const draft = (content: string) => ({ content, kind: 'note', retention: 'forever' } as const);
test('version-one migration preserves a byte-exact backup and all original items before the first write', async (t) => {
  const { file, store } = await fixture(t); const item = (await store.save(draft('keep me'))).items[0];
  const original = JSON.stringify({ version: 1, items: [item] }, null, 2); await writeFile(file, original);
  const migrated = new ShelfStore(file); assert.equal((await migrated.list()).items[0].id, item.id);
  await migrated.createPocket('Research'); assert.equal(await readFile(`${file}.v1-backup`, 'utf8'), original);
  const reopened = await new ShelfStore(file).list(); assert.equal(reopened.version, 2); assert.equal(reopened.pockets[0].name, 'Research'); assert.equal(reopened.items[0].content, 'keep me');
});
test('task pockets persist assignment/renaming and deleting a group unassigns active and deleted items', async (t) => {
  const { store, reopen } = await fixture(t); const pocket = (await store.createPocket('Research')).pockets[0];
  const first = (await store.save(draft('link notes'))).items[0], second = (await store.save(draft('image notes'))).items[0];
  await store.assignPocket(first.id, pocket.id); await store.assignPocket(second.id, pocket.id); await store.remove(second.id);
  await store.renamePocket(pocket.id, 'Application');
  assert.equal((await reopen().list()).items[0].pocketId, pocket.id); assert.equal((await reopen().list()).pockets[0].name, 'Application');
  await assert.rejects(store.createPocket('application'), /already exists/);
  const result = await store.deletePocket(pocket.id); assert.deepEqual(result.pockets, []); assert.equal(result.items[0].pocketId, undefined); assert.equal(result.trash[0].pocketId, undefined);
});
test('paste queue preserves explicit order across restart and deletes remove references without deleting other values', async (t) => {
  const { store, reopen } = await fixture(t);
  const a = (await store.save(draft('first'))).items[0], b = (await store.save(draft('second'))).items[0], c = (await store.save(draft('third'))).items[0];
  await store.toggleQueue(a.id); await store.toggleQueue(b.id); await store.toggleQueue(c.id); await store.moveQueue(c.id, 'up');
  assert.deepEqual((await reopen().list()).queue, [a.id, c.id, b.id]);
  await store.advanceQueue(a.id); assert.deepEqual((await store.list()).queue, [c.id, b.id]);
  await store.remove(c.id); const result = await reopen().list(); assert.deepEqual(result.queue, [b.id]); assert.equal(result.items.some((item) => item.id === a.id), true);
});
test('deleted items recover after the undo deadline and restart; purge and the seven-day limit are final', async (t) => {
  const { store, advance, reopen } = await fixture(t); const a = (await store.save(draft('recover'))).items[0];
  await store.remove(a.id); advance(20_000); await assert.rejects(store.undo(), /Recently deleted/);
  const fresh = reopen(); assert.equal((await fresh.list()).trash[0].content, 'recover'); await fresh.restore(a.id);
  assert.equal((await fresh.list()).items[0].id, a.id); await fresh.remove(a.id); await fresh.purge(a.id); assert.deepEqual((await fresh.list()).trash, []);
  const b = (await fresh.save(draft('expires from trash'))).items[0]; await fresh.remove(b.id); advance(7 * 86_400_000); assert.deepEqual((await fresh.list()).trash, []);
});
test('reminders keep temporary content alive, surface overdue items once after restart and can be rescheduled', async (t) => {
  const { store, advance, reopen } = await fixture(t);
  const a = (await store.save({ content: 'temporary reminder', kind: 'note', retention: 'day' })).items[0];
  await store.remind(a.id, a.createdAt + 60_000); advance(4 * 86_400_000);
  const fresh = reopen(); assert.equal((await fresh.list()).items.length, 1);
  const due = await fresh.claimReminders(); assert.equal(due.items[0].id, a.id); assert.equal(due.items[0].remindedAt, a.createdAt + 4 * 86_400_000); assert.equal(due.items[0].expiresAt, a.createdAt + 5 * 86_400_000);
  advance(1000); assert.equal((await fresh.claimReminders()).items[0].remindedAt, due.items[0].remindedAt);
  await fresh.remind(a.id, due.items[0].createdAt + 60_000); assert.equal((await fresh.list()).items[0].remindedAt, undefined);
  await fresh.acknowledgeReminder(a.id); assert.equal((await fresh.list()).items[0].reminderAt, undefined);
});
test('automatic capture deduplicates notes and persists monitoring preference; re-copying an old pinned item stays readable', async (t) => {
  const { store, advance, reopen } = await fixture(t); const a = (await store.save({ content: 'hello', kind: 'note', retention: 'day' })).items[0];
  await store.pin(a.id); advance(3 * 86_400_000); await store.captureText('hello', fingerprint({ text: 'hello' }));
  await store.setMonitoring(false); const result = await reopen().list(); assert.equal(result.items.length, 1); assert.equal(result.items[0].id, a.id); assert.equal(result.items[0].kind, 'note'); assert.equal(result.items[0].pinned, true); assert.equal(result.monitoring, false);
});
test('text cleanup has independent expected results and preserves the input', () => {
  const text = '  HeLLo world  \r\n  second line  \r\n  HeLLo world  ';
  assert.equal(cleanText(text, 'plain'), text);
  assert.equal(cleanText(text, 'trim'), 'HeLLo world\nsecond line\nHeLLo world');
  assert.equal(cleanText('aBc é', 'upper'), 'ABC É'); assert.equal(cleanText('aBc É', 'lower'), 'abc é');
  assert.equal(cleanText('hELLO wORLD', 'title'), 'Hello World');
  assert.equal(cleanText('a\r\nb\r\na\r\nB', 'dedupe'), 'a\nb\nB');
  assert.throws(() => cleanText('hello', 'toString' as any), /Choose/);
});
