import test from 'node:test';
import assert from 'node:assert/strict';
import { ClipboardWatcher, fingerprint } from '../core/clipboard-watcher.js';
import type { ClipboardContents } from '../core/clipboard-watcher.js';

test('clipboard watcher captures changes once, ignores blank/private contents and its own copies', async () => {
  let contents: ClipboardContents = { text: 'first' }; const saved: string[] = [];
  const watcher = new ClipboardWatcher(async () => contents, async (value) => { saved.push(value.text); }, () => true, (error) => { throw error; });
  await watcher.tick(); await watcher.tick();
  contents = { text: '' }; await watcher.tick(); contents = { text: 'secret', excluded: true }; await watcher.tick();
  contents = { text: 'app copy' }; watcher.suppress(contents); await watcher.tick();
  contents = { text: 'second' }; await watcher.tick();
  assert.deepEqual(saved, ['first', 'second']);
});
test('paused history does not read the OS and resumes with the current contents', async () => {
  let enabled = false, reads = 0; const saved: string[] = [];
  const watcher = new ClipboardWatcher(async () => { reads++; return { text: 'latest' }; }, async (value) => { saved.push(value.text); }, () => enabled, assert.fail);
  await watcher.tick(); assert.equal(reads, 0);
  enabled = true; await watcher.tick(); assert.deepEqual(saved, ['latest']);
});
test('a clipboard read completing after pause or an app copy is discarded, with no overlapping reads', async () => {
  let resolve!: (value: ClipboardContents) => void, reads = 0;
  const saved: string[] = [];
  const watcher = new ClipboardWatcher(() => { reads++; return new Promise((done) => { resolve = done; }); }, async (value) => { saved.push(value.text); }, () => true, assert.fail);
  const pending = watcher.tick(); await watcher.tick(); assert.equal(reads, 1);
  watcher.invalidate(); resolve({ text: 'stale read' }); await pending; assert.deepEqual(saved, []);
  const second = watcher.tick(); watcher.suppress({ text: 'copied by app' }); resolve({ text: 'another stale read' }); await second; assert.deepEqual(saved, []);
});
test('failed captures report once and use retry backoff without accepting the failed fingerprint', async () => {
  let count = 0; const errors: unknown[] = [];
  const watcher = new ClipboardWatcher(async () => ({ text: 'retry' }), async () => { count++; throw new Error('disk full'); }, () => true, (error) => errors.push(error));
  await watcher.tick(); await watcher.tick(); assert.equal(count, 1); assert.match(String(errors[0]), /disk full/);
});
test('fingerprints distinguish bytes and kind, normalize Windows line endings, and seed restart suppression', async () => {
  assert.equal(fingerprint({ text: 'a\r\nb' }), fingerprint({ text: 'a\nb' }));
  assert.notEqual(fingerprint({ text: 'a' }), fingerprint({ text: '', image: Buffer.from('a') }));
  assert.notEqual(fingerprint({ text: '', image: Buffer.from('a') }), fingerprint({ text: '', image: Buffer.from('b') }));
  let captures = 0;
  const watcher = new ClipboardWatcher(async () => ({ text: 'existing' }), async () => { captures++; }, () => true, assert.fail);
  watcher.seed(fingerprint({ text: 'existing' })); await watcher.tick(); assert.equal(captures, 0);
});
