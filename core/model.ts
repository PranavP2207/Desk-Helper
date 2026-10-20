import type { Corner, WidgetState } from './widget.js';
export type ItemKind = 'text' | 'link' | 'note' | 'image';
export type Retention = 'day' | 'week' | 'forever';
export interface ImageInfo { id: string; width: number; height: number; bytes: number }

export interface ShelfItem {
  id: string;
  content: string;
  title: string;
  kind: ItemKind;
  pinned: boolean;
  createdAt: number;
  expiresAt: number | null;
  retention: Retention;
  image?: ImageInfo;
  pocketId?: string;
  fingerprint?: string;
  reminderAt?: number;
  remindedAt?: number;
}
export interface DeletedItem extends ShelfItem { deletedAt: number; purgeAt: number }
export interface TaskPocket { id: string; name: string; createdAt: number }

export interface ItemDraft {
  content: string;
  title?: string;
  kind: 'text' | 'note';
  retention: Retention;
  pocketId?: string;
}

export interface Snapshot { version: 2; items: ShelfItem[]; trash: DeletedItem[]; pockets: TaskPocket[]; queue: string[]; monitoring: boolean; clipboardFingerprint?: string }
export interface AppInfo { shortcut: string; shortcutAvailable: boolean; cursorShortcutAvailable: boolean; queueShortcutAvailable: boolean; version: string }
export type Cleanup = 'plain' | 'trim' | 'upper' | 'lower' | 'title' | 'dedupe';
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface DeskHelperAPI {
  list(): Promise<Result<Snapshot>>;
  save(draft: ItemDraft): Promise<Result<Snapshot>>;
  capture(retention: Retention): Promise<Result<Snapshot>>;
  pin(id: string): Promise<Result<Snapshot>>;
  remove(id: string): Promise<Result<Snapshot>>;
  undo(): Promise<Result<Snapshot>>;
  copy(id: string, tuck?: boolean): Promise<Result<null>>;
  hide(): Promise<Result<null>>;
  quit(): Promise<Result<null>>;
  info(): Promise<Result<AppInfo>>;
  onChange(callback: (snapshot: Snapshot) => void): () => void;
  onFocusSearch(callback: () => void): () => void;
  onError(callback: (message: string) => void): () => void;
  widgetState(): Promise<Result<WidgetState>>;
  expandWidget(nearCursor?: boolean): Promise<Result<null>>;
  collapseWidget(): Promise<Result<null>>;
  hideWidget(): Promise<Result<null>>;
  widgetActivity(active: boolean): Promise<Result<null>>;
  widgetInteract(): Promise<Result<null>>;
  keepWidgetOpen(keep: boolean): Promise<Result<WidgetState>>;
  positionWidget(position: { corner: Corner; displayId: string }): Promise<Result<WidgetState>>;
  openLibrary(): Promise<Result<null>>;
  monitoring(enabled: boolean): Promise<Result<Snapshot>>;
  createPocket(name: string): Promise<Result<Snapshot>>;
  renamePocket(id: string, name: string): Promise<Result<Snapshot>>;
  deletePocket(id: string): Promise<Result<Snapshot>>;
  assignPocket(id: string, pocketId: string | null): Promise<Result<Snapshot>>;
  queueToggle(id: string): Promise<Result<Snapshot>>;
  queueMove(id: string, direction: 'up' | 'down'): Promise<Result<Snapshot>>;
  copyNext(): Promise<Result<Snapshot>>;
  remind(id: string, at: number | null): Promise<Result<Snapshot>>;
  acknowledgeReminder(id: string): Promise<Result<Snapshot>>;
  restore(id: string): Promise<Result<Snapshot>>;
  purge(id: string): Promise<Result<Snapshot>>;
  clean(id: string, operation: Cleanup, action: 'save' | 'copy'): Promise<Result<Snapshot>>;
  startDrag(id: string): void;
  onReminder(callback: (id: string) => void): () => void;
  onWidgetState(callback: (state: WidgetState) => void): () => void;
}

export const MAX_CONTENT_LENGTH = 50_000;
export const MAX_ITEMS = 1_000;
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const TRASH_DURATION = 7 * 86_400_000;
export const emptySnapshot = (): Snapshot => ({ version: 2, items: [], trash: [], pockets: [], queue: [], monitoring: true });
export const imageURL = (item: ShelfItem) => item.image ? `app://deskhelper/images/${item.image.id}.png` : '';
export const RETENTION_LABELS: Record<Retention, string> = { day: '24 hours', week: '7 days', forever: 'Until I delete it' };

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid saved item.');
  return value as Record<string, unknown>;
}

export function validRetention(value: unknown): Retention {
  if (value !== 'day' && value !== 'week' && value !== 'forever') throw new Error('Choose a valid keep duration.');
  return value;
}

export function readDraft(value: unknown): ItemDraft {
  const draft = record(value);
  if (typeof draft.content !== 'string' || !draft.content.trim()) throw new Error('Add some text first.');
  if (draft.content.length > MAX_CONTENT_LENGTH) throw new Error('This item is too long. Keep it under 50,000 characters.');
  if (draft.kind !== 'text' && draft.kind !== 'note') throw new Error('Choose text or a note.');
  if (draft.title !== undefined && (typeof draft.title !== 'string' || draft.title.length > 120)) throw new Error('Keep the title under 120 characters.');
  return {
    content: draft.content.replace(/\r\n/g, '\n'),
    title: typeof draft.title === 'string' ? draft.title.trim() : undefined,
    kind: draft.kind,
    retention: validRetention(draft.retention),
    ...(draft.pocketId !== undefined ? { pocketId: validId(draft.pocketId) } : {}),
  };
}

export function classify(content: string, requested: 'text' | 'note'): ItemKind {
  if (requested === 'note') return 'note';
  try {
    const url = new URL(content.trim());
    return /^https?:$/.test(url.protocol) && !/\s/.test(content.trim()) ? 'link' : 'text';
  } catch { return 'text'; }
}

export function expiration(retention: Retention, now: number): number | null {
  if (retention === 'forever') return null;
  return now + (retention === 'day' ? 1 : 7) * 86_400_000;
}

export function pruneExpired(items: ShelfItem[], now: number): ShelfItem[] {
  const remaining = items.filter((item) => item.pinned || (item.reminderAt && !item.remindedAt) || item.expiresAt === null || item.expiresAt > now);
  return remaining.length === items.length ? items : remaining;
}

export function readItem(value: unknown): ShelfItem {
  const item = record(value);
  if (typeof item.id !== 'string' || !/^[\da-f-]{36}$/i.test(item.id)) throw new Error('Invalid item ID.');
  if (typeof item.content !== 'string' || !item.content.trim() || item.content.length > MAX_CONTENT_LENGTH) throw new Error('Invalid item content.');
  if (typeof item.title !== 'string' || item.title.length > 120) throw new Error('Invalid item title.');
  if (item.kind !== 'text' && item.kind !== 'note' && item.kind !== 'link' && item.kind !== 'image') throw new Error('Invalid item kind.');
  if (typeof item.pinned !== 'boolean') throw new Error('Invalid pin state.');
  if (typeof item.createdAt !== 'number' || !Number.isSafeInteger(item.createdAt) || item.createdAt <= 0) throw new Error('Invalid item date.');
  if (item.expiresAt !== null && (typeof item.expiresAt !== 'number' || !Number.isSafeInteger(item.expiresAt) || item.expiresAt < item.createdAt)) throw new Error('Invalid expiration date.');
  const image = item.kind === 'image' ? readImageInfo(item.image) : undefined;
  return {
    id: item.id, content: item.content, title: item.title, kind: item.kind, pinned: item.pinned,
    createdAt: item.createdAt, expiresAt: item.expiresAt as number | null, retention: validRetention(item.retention),
    ...(image ? { image } : {}),
    ...(item.pocketId !== undefined ? { pocketId: validId(item.pocketId) } : {}),
    ...(item.fingerprint !== undefined ? { fingerprint: validFingerprint(item.fingerprint) } : {}),
    ...(item.reminderAt !== undefined ? { reminderAt: validDate(item.reminderAt) } : {}),
    ...(item.remindedAt !== undefined ? { remindedAt: validDate(item.remindedAt) } : {}),
  };
}

export function readImageInfo(value: unknown): ImageInfo {
  const image = record(value);
  if (typeof image.id !== 'string' || !/^[\da-f-]{36}$/i.test(image.id)) throw new Error('Invalid image ID.');
  if (![image.width, image.height, image.bytes].every((n) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0)) throw new Error('Invalid image dimensions.');
  if ((image.width as number) > 16384 || (image.height as number) > 16384 || (image.width as number) * (image.height as number) > 80_000_000 || (image.bytes as number) > MAX_IMAGE_BYTES) throw new Error('This image is too large. Use a smaller region (up to 12 MB).');
  return { id: image.id, width: image.width as number, height: image.height as number, bytes: image.bytes as number };
}

export function readSnapshot(value: unknown): Snapshot {
  const data = record(value);
  if ((data.version !== 1 && data.version !== 2) || !Array.isArray(data.items) || data.items.length > MAX_ITEMS) throw new Error('Unsupported or invalid saved data.');
  const items = data.items.map(readItem);
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('Duplicate saved item IDs.');
  if (data.version === 1) return { ...emptySnapshot(), items };
  if (!Array.isArray(data.trash) || data.trash.length > MAX_ITEMS || !Array.isArray(data.pockets) || data.pockets.length > 100 || !Array.isArray(data.queue) || data.queue.length > MAX_ITEMS || typeof data.monitoring !== 'boolean') throw new Error('Invalid saved shelf.');
  const trash = data.trash.map((value) => { const item = record(value); return { ...readItem(item), deletedAt: validDate(item.deletedAt), purgeAt: validDate(item.purgeAt) }; });
  const pockets = data.pockets.map((value) => { const pocket = record(value); return { id: validId(pocket.id), name: validPocketName(pocket.name), createdAt: validDate(pocket.createdAt) }; });
  const queue = data.queue.map(validId);
  if (new Set([...items, ...trash].map((item) => item.id)).size !== items.length + trash.length || new Set(pockets.map((pocket) => pocket.id)).size !== pockets.length || new Set(queue).size !== queue.length || queue.some((id) => !items.some((item) => item.id === id)) || [...items, ...trash].some((item) => item.pocketId && !pockets.some((pocket) => pocket.id === item.pocketId))) throw new Error('Invalid saved references.');
  return { version: 2, items, trash, pockets, queue, monitoring: data.monitoring, ...(data.clipboardFingerprint !== undefined ? { clipboardFingerprint: validFingerprint(data.clipboardFingerprint) } : {}) };
}

export function validId(value: unknown): string { if (typeof value !== 'string' || !/^[\da-f-]{36}$/i.test(value)) throw new Error('Invalid item.'); return value; }
export function validDate(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid date.'); return value; }
export function validFingerprint(value: unknown): string { if (typeof value !== 'string' || !/^[\da-f]{64}$/i.test(value)) throw new Error('Invalid clipboard fingerprint.'); return value; }
export function validPocketName(value: unknown): string { if (typeof value !== 'string' || !value.trim() || value.trim().length > 40) throw new Error('Use a pocket name between 1 and 40 characters.'); return value.trim(); }
