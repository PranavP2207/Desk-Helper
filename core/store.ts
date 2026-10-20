import { mkdir, readFile, rename, unlink, writeFile, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { classify, emptySnapshot, expiration, MAX_ITEMS, pruneExpired, readDraft, readSnapshot, readImageInfo, validRetention, TRASH_DURATION, validPocketName, validFingerprint, validDate } from './model.js';
import type { ShelfItem, Snapshot, ImageInfo, Retention } from './model.js';

export class ShelfStore {
  private state = emptySnapshot();
  private initialized?: Promise<void>;
  private tail: Promise<unknown> = Promise.resolve();
  private migration = false;
  private deleted?: { id: string; until: number };
  constructor(private readonly file: string, private readonly now: () => number = Date.now) {}

  private initialize(): Promise<void> {
    return this.initialized ??= (async () => {
      try {
        if ((await stat(this.file)).size > 64 * 1024 * 1024) throw new Error('Saved data is too large.');
        const data = JSON.parse(await readFile(this.file, 'utf8'));
        this.state = readSnapshot(data); this.migration = data.version === 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw new Error('Your saved data could not be read. The original file has been preserved.');
      }
    })().catch((error) => { this.initialized = undefined; throw error; });
  }
  private async persist(state: Snapshot) {
    const data = JSON.stringify(state);
    if (Buffer.byteLength(data) > 64 * 1024 * 1024) throw new Error('Your pocket has reached its storage limit. Remove large items or empty Recently deleted.');
    const temp = `${this.file}.${randomUUID()}.tmp`;
    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      if (this.migration) await copyFile(this.file, `${this.file}.v1-backup`, 1).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
      await writeFile(temp, data, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await rename(temp, this.file); this.migration = false;
    } catch { await unlink(temp).catch(() => undefined); throw new Error('Could not save your changes. Check that the data folder is writable and try again.'); }
  }
  private transaction(change: (state: Snapshot, now: number) => Snapshot, committed?: () => void): Promise<Snapshot> {
    const operation = this.tail.then(async () => {
      await this.initialize(); const now = this.now();
      let base = this.state;
      const items = pruneExpired(base.items, now); const trash = base.trash.filter((item) => item.purgeAt > now);
      const queue = base.queue.filter((id) => items.some((item) => item.id === id));
      if (items !== base.items || trash.length !== base.trash.length || queue.length !== base.queue.length) base = { ...base, items, trash, queue };
      const next = change(base, now);
      if (next !== this.state) { await this.persist(next); this.state = next; }
      committed?.(); return structuredClone(this.state);
    });
    this.tail = operation.catch(() => undefined); return operation;
  }
  private item(state: Snapshot, id: string) { const item = state.items.find((item) => item.id === id); if (!item) throw new Error('This item is no longer available.'); return item; }
  private room(state: Snapshot) { if (state.items.length >= MAX_ITEMS) throw new Error('Your pocket is full (1,000 items). Remove a few items first.'); }
  private pocket(state: Snapshot, id?: string | null) { if (id && !state.pockets.some((pocket) => pocket.id === id)) throw new Error('This task pocket no longer exists.'); }
  list() { return this.transaction((state) => state); }
  save(value: unknown): Promise<Snapshot> {
    const draft = readDraft(value);
    return this.transaction((state, now) => {
      this.room(state); this.pocket(state, draft.pocketId);
      const item: ShelfItem = { id: randomUUID(), title: draft.title || draft.content.trim().split('\n')[0].slice(0, 100), content: draft.content, kind: classify(draft.content, draft.kind), pinned: false, createdAt: now, retention: draft.retention, expiresAt: expiration(draft.retention, now), ...(draft.pocketId ? { pocketId: draft.pocketId } : {}) };
      return { ...state, items: [item, ...state.items] };
    });
  }
  captureText(content: string, fingerprint: string) {
    const draft = readDraft({ content, kind: 'text', retention: 'day' }); validFingerprint(fingerprint);
    return this.transaction((state, now) => {
      const existing = state.items.find((item) => !item.image && item.content === draft.content);
      if (existing) return { ...state, clipboardFingerprint: fingerprint, items: [{ ...existing, fingerprint, createdAt: now, expiresAt: expiration(existing.retention, Math.max(now, existing.reminderAt ?? 0)) }, ...state.items.filter((item) => item.id !== existing.id)] };
      this.room(state);
      return { ...state, clipboardFingerprint: fingerprint, items: [{ id: randomUUID(), title: draft.content.trim().split('\n')[0].slice(0, 100), content: draft.content, kind: classify(draft.content, 'text'), pinned: false, createdAt: now, expiresAt: expiration('day', now), retention: 'day', fingerprint }, ...state.items] };
    });
  }
  async duplicateImage(fingerprint: string): Promise<Snapshot | null> {
    validFingerprint(fingerprint); let found = false;
    const snapshot = await this.transaction((state, now) => {
      const existing = state.items.find((item) => item.fingerprint === fingerprint && item.image);
      if (!existing) return state; found = true;
      return { ...state, clipboardFingerprint: fingerprint, items: [{ ...existing, createdAt: now, expiresAt: expiration(existing.retention, Math.max(now, existing.reminderAt ?? 0)) }, ...state.items.filter((item) => item.id !== existing.id)] };
    }); return found ? snapshot : null;
  }
  saveImage(info: ImageInfo, title: string, keep: Retention, fingerprint?: string) {
    const image = readImageInfo(info); const retention = validRetention(keep); if (fingerprint) validFingerprint(fingerprint);
    return this.transaction((state, now) => {
      this.room(state);
      return { ...state, ...(fingerprint ? { clipboardFingerprint: fingerprint } : {}), items: [{ id: randomUUID(), title: title.slice(0, 120), content: title.slice(0, 120), kind: 'image', pinned: false, createdAt: now, expiresAt: expiration(retention, now), retention, image, ...(fingerprint ? { fingerprint } : {}) }, ...state.items] };
    });
  }
  async imageReferences() { const state = await this.list(); return new Set([...state.items, ...state.trash].flatMap((item) => item.image ? [item.image.id] : [])); }
  pin(id: string) { return this.transaction((state, now) => { this.item(state, id); return { ...state, items: state.items.map((item) => item.id === id ? { ...item, pinned: !item.pinned, expiresAt: item.pinned ? expiration(item.retention, Math.max(now, item.reminderAt ?? 0)) : item.expiresAt } : item) }; }); }
  remove(id: string) {
    return this.transaction((state, now) => {
      const item = this.item(state, id);
      if (state.trash.length >= MAX_ITEMS) throw new Error('Recently deleted is full. Permanently remove some deleted items first.');
      return { ...state, items: state.items.filter((item) => item.id !== id), queue: state.queue.filter((item) => item !== id), trash: [{ ...item, deletedAt: now, purgeAt: now + TRASH_DURATION }, ...state.trash] };
    }, () => { this.deleted = { id, until: this.now() + 15_000 }; });
  }
  private restored(state: Snapshot, id: string, now: number) {
    const item = state.trash.find((item) => item.id === id); if (!item) throw new Error('This deleted item is no longer available.'); this.room(state);
    const { deletedAt, purgeAt, ...restored } = item;
    if (!restored.pinned && restored.expiresAt !== null && restored.expiresAt <= now) restored.expiresAt = expiration(restored.retention, now);
    return { ...state, items: [restored, ...state.items], trash: state.trash.filter((item) => item.id !== id) };
  }
  restore(id: string) { return this.transaction((state, now) => this.restored(state, id, now)); }
  purge(id: string) { return this.transaction((state) => { if (!state.trash.some((item) => item.id === id)) throw new Error('This deleted item is no longer available.'); return { ...state, trash: state.trash.filter((item) => item.id !== id) }; }); }
  undo() { return this.transaction((state, now) => { if (!this.deleted || this.deleted.until <= now) throw new Error('The undo window has passed. Use Recently deleted instead.'); return this.restored(state, this.deleted.id, now); }, () => { this.deleted = undefined; }); }
  setMonitoring(enabled: boolean) { if (typeof enabled !== 'boolean') throw new Error('Invalid clipboard setting.'); return this.transaction((state) => state.monitoring === enabled ? state : { ...state, monitoring: enabled }); }
  createPocket(value: unknown) { const name = validPocketName(value); return this.transaction((state, now) => { if (state.pockets.length >= 100) throw new Error('You can keep up to 100 task pockets.'); if (state.pockets.some((pocket) => pocket.name.toLowerCase() === name.toLowerCase())) throw new Error('A pocket with that name already exists.'); return { ...state, pockets: [...state.pockets, { id: randomUUID(), name, createdAt: now }] }; }); }
  renamePocket(id: string, value: unknown) { const name = validPocketName(value); return this.transaction((state) => { this.pocket(state, id); if (state.pockets.some((pocket) => pocket.id !== id && pocket.name.toLowerCase() === name.toLowerCase())) throw new Error('A pocket with that name already exists.'); return { ...state, pockets: state.pockets.map((pocket) => pocket.id === id ? { ...pocket, name } : pocket) }; }); }
  deletePocket(id: string) { return this.transaction((state) => { this.pocket(state, id); const unassign = <T extends ShelfItem>(item: T): T => { if (item.pocketId !== id) return item; const { pocketId, ...rest } = item; return rest as T; }; return { ...state, pockets: state.pockets.filter((pocket) => pocket.id !== id), items: state.items.map(unassign), trash: state.trash.map(unassign) }; }); }
  assignPocket(id: string, pocketId: string | null) { return this.transaction((state) => { this.item(state, id); this.pocket(state, pocketId); return { ...state, items: state.items.map((item) => { if (item.id !== id) return item; const { pocketId: _old, ...rest } = item; return pocketId ? { ...rest, pocketId } : rest; }) }; }); }
  toggleQueue(id: string) { return this.transaction((state) => { this.item(state, id); return { ...state, queue: state.queue.includes(id) ? state.queue.filter((item) => item !== id) : [...state.queue, id] }; }); }
  moveQueue(id: string, direction: 'up' | 'down') { if (direction !== 'up' && direction !== 'down') throw new Error('Choose up or down.'); return this.transaction((state) => { const queue = [...state.queue]; const index = queue.indexOf(id); if (index < 0) throw new Error('This item is not in the queue.'); const other = index + (direction === 'up' ? -1 : 1); if (other < 0 || other >= queue.length) return state; [queue[index], queue[other]] = [queue[other], queue[index]]; return { ...state, queue }; }); }
  advanceQueue(id: string) { return this.transaction((state) => ({ ...state, queue: state.queue.filter((value) => value !== id) })); }
  remind(id: string, value: number | null) { return this.transaction((state, now) => {
    this.item(state, id); if (value !== null && (validDate(value) <= now || value > now + 366 * 86_400_000)) throw new Error('Choose a time in the next year.');
    return { ...state, items: state.items.map((item) => { if (item.id !== id) return item; const { reminderAt, remindedAt, ...rest } = item; return value === null ? rest : { ...rest, reminderAt: value, expiresAt: rest.expiresAt === null ? null : Math.max(rest.expiresAt, value + 86_400_000) }; }) };
  }); }
  claimReminders() { return this.transaction((state, now) => {
    const due = state.items.filter((item) => item.reminderAt && item.reminderAt <= now && !item.remindedAt);
    if (!due.length) return state; const ids = new Set(due.map((item) => item.id));
    return { ...state, items: [...due.map((item) => ({ ...item, remindedAt: now, createdAt: now, expiresAt: expiration(item.retention, now) })), ...state.items.filter((item) => !ids.has(item.id))] };
  }); }
  acknowledgeReminder(id: string) { return this.remind(id, null); }
}
