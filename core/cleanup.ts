import type { Cleanup } from './model.js';
export const CLEANUP_LABELS: Record<Cleanup, string> = { plain: 'Plain text', trim: 'Trim whitespace', upper: 'UPPERCASE', lower: 'lowercase', title: 'Title Case', dedupe: 'Remove duplicate lines' };
export function cleanText(text: string, operation: Cleanup): string {
  if (!Object.hasOwn(CLEANUP_LABELS, operation)) throw new Error('Choose a text cleanup action.');
  switch (operation) {
    case 'plain': return text;
    case 'trim': return text.split(/\r?\n/).map((line) => line.trim()).join('\n').trim();
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'title': return text.toLowerCase().replace(/\p{L}[\p{L}\p{M}'’-]*/gu, (word) => word[0].toUpperCase() + word.slice(1));
    case 'dedupe': return [...new Set(text.split(/\r?\n/))].join('\n');
  }
}
