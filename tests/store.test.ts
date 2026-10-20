import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ShelfStore } from '../core/store.js';

const base = path.resolve('.local-data/unit');
await mkdir(base, { recursive: true });

async function fixture(t: test.TestContext) {
  const dir = await mkdtemp(path.join(base, 'store-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, file: path.join(dir, 'shelf.json') };
}

test('saves exact content and kind to disk, then reads it in a new store', async (t) => {
  const { file } = await fixture(t);
  const store = new ShelfStore(file, () => 1_800_000_000_000);
  await store.save({ content: '  Keep indentation\nsecond line  ', title: 'A thought', kind: 'note', retention: 'forever' });
  await store.save({ content: 'https://example.com/reference', kind: 'text', retention: 'week' });
  const reopened = await new ShelfStore(file, () => 1_800_000_000_000).list();
  assert.deepEqual(reopened.items.map(({ content, kind, title, retention }) => ({ content, kind, title, retention })), [
    { content: 'https://example.com/reference', kind: 'link', title: 'https://example.com/reference', retention: 'week' },
    { content: '  Keep indentation\nsecond line  ', kind: 'note', title: 'A thought', retention: 'forever' },
  ]);
  const raw = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(raw.items[0].expiresAt, 1_800_604_800_000);
  assert.equal(raw.items[1].expiresAt, null);
});

test('expiration removes an unpinned item exactly at its deadline but keeps pinned and permanent items', async (t) => {
  const { file } = await fixture(t);
  let now = 1_800_000_000_000;
  const store = new ShelfStore(file, () => now);
  await store.save({ content: 'temporary', kind: 'text', retention: 'day' });
  const { items } = await store.save({ content: 'pinned', kind: 'text', retention: 'day' });
  await store.pin(items[0].id);
  await store.save({ content: 'permanent', kind: 'note', retention: 'forever' });
  now = 1_800_086_399_999;
  assert.equal((await store.list()).items.find((item) => item.content === 'temporary')?.content, 'temporary');
  now = 1_800_086_400_000;
  assert.deepEqual((await store.list()).items.map((item) => item.content), ['permanent', 'pinned']);
  assert.deepEqual((await new ShelfStore(file, () => now).list()).items.map((item) => item.content), ['permanent', 'pinned']);
});

test('unpinning a past-due item restarts its retention instead of immediately losing it', async (t) => {
  const { file } = await fixture(t);
  let now = 1_800_000_000_000;
  const store = new ShelfStore(file, () => now);
  const created = (await store.save({ content: 'keep me', kind: 'text', retention: 'day' })).items[0];
  await store.pin(created.id);
  now = 1_800_172_800_000;
  const unpinned = (await store.pin(created.id)).items[0];
  assert.equal(unpinned.pinned, false);
  assert.equal(unpinned.expiresAt, 1_800_259_200_000);
  assert.equal((await new ShelfStore(file, () => now).list()).items[0].content, 'keep me');
});

test('concurrent saves do not drop any item, and returned snapshots cannot mutate the store', async (t) => {
  const { file, dir } = await fixture(t);
  const store = new ShelfStore(file);
  await Promise.all(Array.from({ length: 12 }, (_, index) => store.save({ content: `entry-${index}`, kind: 'text', retention: 'forever' })));
  const result = await store.list();
  assert.deepEqual(result.items.map((item) => item.content).sort(), Array.from({ length: 12 }, (_, index) => `entry-${index}`).sort());
  result.items[0].content = 'tampered';
  result.items.pop();
  const disk = await new ShelfStore(file).list();
  assert.equal(disk.items.length, 12);
  assert.equal(disk.items.some((item) => item.content === 'tampered'), false);
  assert.deepEqual(await readdir(dir), ['shelf.json']);
});

test('delete and undo restore the same item across disk reload; undo is single-use and time-limited', async (t) => {
  const { file } = await fixture(t);
  let now = 1_800_000_000_000;
  const store = new ShelfStore(file, () => now);
  const original = (await store.save({ content: 'a keeper', kind: 'note', retention: 'forever' })).items[0];
  await store.remove(original.id);
  assert.deepEqual((await new ShelfStore(file, () => now).list()).items, []);
  await store.undo();
  assert.deepEqual((await new ShelfStore(file, () => now).list()).items, [original]);
  await assert.rejects(store.undo(), /undo window/);
  await store.remove(original.id);
  now += 15_000;
  await assert.rejects(store.undo(), /undo window/);
  assert.deepEqual((await new ShelfStore(file, () => now).list()).items, []);
});

test('malformed or unknown-version data is preserved and never overwritten by a save', async (t) => {
  const { file } = await fixture(t);
  for (const original of ['{broken json', '{"version":99,"items":[]}', '{"version":1,"items":[{"id":"bad"}]}']) {
    await writeFile(file, original);
    const store = new ShelfStore(file);
    await assert.rejects(store.list(), /original file has been preserved/);
    await assert.rejects(store.save({ content: 'new text', kind: 'text', retention: 'day' }), /original file has been preserved/);
    assert.equal(await readFile(file, 'utf8'), original);
  }
});

test('failed disk commits do not enter memory; the serialized queue can recover', async (t) => {
  const { dir } = await fixture(t);
  const parent = path.join(dir, 'blocked');
  const file = path.join(parent, 'shelf.json');
  const store = new ShelfStore(file);
  await store.list();
  await writeFile(parent, 'not a directory');
  await assert.rejects(store.save({ content: 'must not appear', kind: 'text', retention: 'forever' }));
  await rm(parent);
  assert.deepEqual((await store.list()).items, []);
  await store.save({ content: 'recovered', kind: 'text', retention: 'forever' });
  assert.deepEqual((await new ShelfStore(file).list()).items.map((item) => item.content), ['recovered']);
});

test('retry can load a repaired data file without restarting the application', async (t) => {
  const { file } = await fixture(t);
  await writeFile(file, '{damaged');
  const store = new ShelfStore(file);
  await assert.rejects(store.list(), /original file has been preserved/);
  await writeFile(file, '{"version":1,"items":[]}');
  await store.save({ content: 'saved after repair', kind: 'note', retention: 'forever' });
  assert.deepEqual((await new ShelfStore(file).list()).items.map((item) => item.content), ['saved after repair']);
});

test('empty content and invalid retention never create or overwrite entries; non-web schemes remain plain text', async (t) => {
  const { file } = await fixture(t);
  const store = new ShelfStore(file);
  assert.throws(() => store.save({ content: ' \n ', kind: 'text', retention: 'day' }), /Add some text/);
  assert.throws(() => store.save({ content: 'hello', kind: 'text', retention: 'hour' }), /valid keep duration/);
  const result = await store.save({ content: 'javascript:alert(1)', kind: 'text', retention: 'forever' });
  assert.equal(result.items[0].kind, 'text');
  assert.equal((await new ShelfStore(file).list()).items[0].content, 'javascript:alert(1)');
});
