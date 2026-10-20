import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ShelfStore } from '../core/store.js';
import { ImageStore } from '../core/images.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const base = path.resolve('.local-data/unit');
await mkdir(base, { recursive: true });
async function fixture(t: test.TestContext) {
  const dir = await mkdtemp(path.join(base, 'images-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'shelf.json'); const directory = path.join(dir, 'images');
  return { dir, file, directory };
}

test('images persist as exact PNG bytes with metadata across store restart', async (t) => {
  const { file, directory } = await fixture(t);
  const shelf = new ShelfStore(file);
  await shelf.save({ content: 'old text remains', kind: 'text', retention: 'forever' });
  const images = new ImageStore(directory, shelf);
  const saved = await images.save(png, { width: 1, height: 1 }, 'A screenshot', 'forever');
  const image = saved.items[0];
  assert.equal(image.kind, 'image');
  assert.deepEqual(image.image, { id: image.image!.id, width: 1, height: 1, bytes: png.length });
  assert.deepEqual(await images.read(image.image!.id), png);
  const reopened = await new ShelfStore(file).list();
  assert.deepEqual(reopened.items.map((item) => item.content), ['A screenshot', 'old text remains']);
  assert.deepEqual(reopened.items[0].image, image.image);
  assert.equal((await readFile(file, 'utf8')).includes(png.toString('base64')), false);
});

test('cleanup preserves deleted images for seven days, including across restart, then removes them', async (t) => {
  const { file, directory } = await fixture(t);
  let now = 1_800_000_000_000;
  const shelf = new ShelfStore(file, () => now);
  const images = new ImageStore(directory, shelf);
  const item = (await images.save(png, { width: 1, height: 1 }, 'Undo image', 'forever')).items[0];
  await shelf.remove(item.id); await images.clean();
  assert.deepEqual(await readdir(directory), [`${item.image!.id}.png`]);
  await shelf.undo(); await images.clean();
  assert.deepEqual(await images.read(item.image!.id), png);
  await shelf.remove(item.id); now += 15_000; await images.clean();
  const reopened = new ShelfStore(file, () => now);
  assert.deepEqual((await reopened.list()).trash.map((value) => value.id), [item.id]);
  assert.deepEqual(await images.read(item.image!.id), png);
  now += 7 * 86_400_000; await images.clean();
  assert.deepEqual(await readdir(directory), []);
});

test('expired images are cleaned while pinned images and non-owned files remain', async (t) => {
  const { file, directory } = await fixture(t);
  let now = 1_800_000_000_000;
  const shelf = new ShelfStore(file, () => now); const images = new ImageStore(directory, shelf);
  await images.save(png, { width: 1, height: 1 }, 'temporary');
  const pinned = (await images.save(png, { width: 1, height: 1 }, 'pinned')).items[0];
  await shelf.pin(pinned.id);
  await writeFile(path.join(directory, 'notes.txt'), 'not owned by the image cleaner');
  now += 86_400_000; await images.clean();
  assert.deepEqual((await shelf.list()).items.map((item) => item.title), ['pinned']);
  assert.deepEqual((await readdir(directory)).sort(), [`${pinned.image!.id}.png`, 'notes.txt'].sort());
});

test('invalid image input cannot create entries or escape the image directory', async (t) => {
  const { file, directory } = await fixture(t);
  const shelf = new ShelfStore(file); const images = new ImageStore(directory, shelf);
  await assert.rejects(images.save(Buffer.from('not a PNG'), { width: 1, height: 1 }, 'bad'), /PNG image/);
  await assert.rejects(images.save(png, { width: 100000, height: 1 }, 'too large'), /too large/);
  assert.throws(() => images.path('../shelf'), /Invalid image/);
  assert.deepEqual((await shelf.list()).items, []);
});

test('an image file is rolled back if its metadata cannot be committed', async (t) => {
  const { file, directory } = await fixture(t);
  class RejectingShelf extends ShelfStore {
    override saveImage(): ReturnType<ShelfStore['saveImage']> { return Promise.reject(new Error('simulated metadata write failure')); }
  }
  const shelf = new RejectingShelf(file); const images = new ImageStore(directory, shelf);
  await assert.rejects(images.save(png, { width: 1, height: 1 }, 'not committed'), /metadata write failure/);
  assert.deepEqual(await readdir(directory), []);
  assert.deepEqual((await shelf.list()).items, []);
});
