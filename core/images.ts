import { randomUUID } from 'node:crypto';
import { mkdir, readdir, stat, unlink, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_IMAGE_BYTES, readImageInfo } from './model.js';
import type { Retention } from './model.js';
import { ShelfStore } from './store.js';

const MAX_STORAGE = 200 * 1024 * 1024;
const imageName = /^[\da-f-]{36}\.png$/i;

export class ImageStore {
  private tail: Promise<unknown> = Promise.resolve();
  private leases = new Map<string, number>();
  constructor(readonly directory: string, private readonly shelf: ShelfStore) {}

  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const operation = this.tail.then(action);
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  path(id: string) {
    if (!/^[\da-f-]{36}$/i.test(id)) throw new Error('Invalid image.');
    return path.join(this.directory, `${id}.png`);
  }

  lease(id: string) { this.path(id); this.leases.set(id, Date.now() + 120_000); }
  save(png: Buffer, size: { width: number; height: number }, title: string, keep: Retention = 'day', fingerprint?: string) {
    return this.serialize(async () => {
      if (png.length > MAX_IMAGE_BYTES || png.length < 8 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Use a PNG image smaller than 12 MB.');
      if (fingerprint) { const existing = await this.shelf.duplicateImage(fingerprint); if (existing) return existing; }
      const info = readImageInfo({ id: randomUUID(), ...size, bytes: png.length });
      await this.cleanFiles();
      await mkdir(this.directory, { recursive: true });
      const names = (await readdir(this.directory)).filter((name) => imageName.test(name));
      const used = (await Promise.all(names.map(async (name) => (await stat(path.join(this.directory, name))).size))).reduce((a, b) => a + b, 0);
      if (used + png.length > MAX_STORAGE) throw new Error('Image storage is full (200 MB). Permanently remove images from Recently deleted to free space.');
      const file = this.path(info.id);
      try {
        await writeFile(file, png, { flag: 'wx', mode: 0o600 });
        return await this.shelf.saveImage(info, title, keep, fingerprint);
      } catch (error) { await unlink(file).catch(() => undefined); throw error; }
    });
  }

  async read(id: string): Promise<Buffer> { return readFile(this.path(id)); }
  clean() { return this.serialize(() => this.cleanFiles()); }
  private async cleanFiles() {
    const references = await this.shelf.imageReferences();
    for (const [id, until] of this.leases) { if (until > Date.now()) references.add(id); else this.leases.delete(id); }
    const names = await readdir(this.directory).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
    await Promise.all(names.filter((name) => imageName.test(name) && !references.has(name.slice(0, -4))).map((name) => unlink(path.join(this.directory, name))));
  }
}
