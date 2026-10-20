import { clipboard, ClipboardItem } from 'electron';
import type { ClipboardContents } from '../core/clipboard-watcher.js';
import { MAX_IMAGE_BYTES } from '../core/model.js';

/** The OS boundary is replaced in tests; MIME encoding/decoding follows the real Electron ClipboardItem API. */
export function clipboardPort(testing: boolean, initialText: string) {
  let memory = [new ClipboardItem({ 'text/plain': initialText })];
  return {
    inject(contents: ClipboardContents) { if (!testing) throw new Error('Test clipboard is unavailable.'); memory = contents.image ? [new ClipboardItem({ 'image/png': new Blob([new Uint8Array(contents.image)], { type: 'image/png' }) })] : [new ClipboardItem({ 'text/plain': contents.text })]; },
    async read(): Promise<ClipboardContents> {
      const items = testing ? memory : await clipboard.read();
      if (items.some((item) => item.types.some((type) => type.includes('ExcludeClipboardContentFromMonitorProcessing')))) return { text: '', excluded: true };
      for (const item of items) for (const type of ['image/png', 'image/jpeg'] as const) if (item.types.includes(type)) {
        const blob = await item.getType(type);
        if (blob.size > MAX_IMAGE_BYTES) throw new Error('Clipboard image exceeds 12 MB. Copy a smaller image or pause clipboard history.');
        return { image: Buffer.from(await blob.arrayBuffer()), text: '' };
      }
      return { image: undefined, text: testing ? await memoryText(memory) : await clipboard.readText() };
    },
    async writeText(text: string) { if (testing) memory = [new ClipboardItem({ 'text/plain': text })]; else await clipboard.writeText(text); },
    async writeImage(png: Buffer) {
      const items = [new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })];
      if (testing) memory = items;
      else await clipboard.write(items);
    },
  };
}
async function memoryText(items: ClipboardItem[]) {
  const item = items.find((item) => item.types.includes('text/plain'));
  return item ? (await item.getType('text/plain')).text() : '';
}
