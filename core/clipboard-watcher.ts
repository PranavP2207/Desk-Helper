import { createHash } from 'node:crypto';
export interface ClipboardContents { text: string; image?: Buffer; excluded?: boolean }
export function fingerprint(contents: ClipboardContents): string {
  return createHash('sha256').update(contents.image ? 'image:' : 'text:').update(contents.image ?? contents.text.replace(/\r\n/g, '\n')).digest('hex');
}
/** One read/capture at a time; generation guards discard reads completed after pause or an app copy. */
export class ClipboardWatcher {
  private busy = false;
  private generation = 0;
  private last?: string;
  private retryAfter = 0;
  constructor(private readonly read: () => Promise<ClipboardContents>, private readonly capture: (contents: ClipboardContents, hash: string) => Promise<void>, private readonly enabled: () => boolean, private readonly error: (error: unknown) => void, initial?: string) { this.last = initial; }
  invalidate() { this.generation++; }
  seed(hash?: string) { this.generation++; this.last = hash; }
  suppress(contents: ClipboardContents) { this.generation++; this.last = fingerprint(contents); }
  async tick() {
    if (this.busy || !this.enabled() || Date.now() < this.retryAfter) return;
    this.busy = true; const generation = this.generation;
    try {
      const contents = await this.read();
      if (generation !== this.generation || !this.enabled() || contents.excluded || (!contents.image && !contents.text.trim())) return;
      const hash = fingerprint(contents); if (hash === this.last) return;
      await this.capture(contents, hash);
      if (generation === this.generation) this.last = hash;
    } catch (error) { this.retryAfter = Date.now() + 5000; this.error(error); }
    finally { this.busy = false; }
  }
}
