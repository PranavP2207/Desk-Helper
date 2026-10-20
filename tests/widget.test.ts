import test from 'node:test';
import assert from 'node:assert/strict';
import { cornerBounds, cursorBounds, Proximity } from '../core/widget.js';

test('the dot and expanded panel share a bottom-right anchor inside the work area', () => {
  const workArea = { x: 0, y: 0, width: 1536, height: 824 };
  assert.deepEqual(cornerBounds(workArea, 'bottom-right', false), { x: 1458, y: 746, width: 64, height: 64 });
  assert.deepEqual(cornerBounds(workArea, 'bottom-right', true), { x: 1146, y: 262, width: 376, height: 548 });
});
test('corner placement handles negative monitor origins and small work areas', () => {
  assert.deepEqual(cornerBounds({ x: -1280, y: -200, width: 1280, height: 960 }, 'top-left', true), { x: -1266, y: -186, width: 376, height: 548 });
  assert.deepEqual(cornerBounds({ x: 100, y: 200, width: 300, height: 400 }, 'bottom-right', true), { x: 114, y: 214, width: 272, height: 372 });
});
test('hover requires 300ms of continuous proximity and leaving resets the dwell', () => {
  const hover = new Proximity(); const bounds = { x: 100, y: 100, width: 64, height: 64 };
  assert.equal(hover.tick(0, { x: 90, y: 110 }, bounds, false, false), null);
  assert.equal(hover.tick(299, { x: 90, y: 110 }, bounds, false, false), null);
  assert.equal(hover.tick(300, { x: 90, y: 110 }, bounds, false, false), 'expand');
  hover.tick(400, { x: 110, y: 110 }, bounds, false, false);
  hover.tick(600, { x: 0, y: 0 }, bounds, false, false);
  assert.equal(hover.tick(700, { x: 110, y: 110 }, bounds, false, false), null);
  assert.equal(hover.tick(999, { x: 110, y: 110 }, bounds, false, false), null);
  assert.equal(hover.tick(1000, { x: 110, y: 110 }, bounds, false, false), 'expand');
});
test('collapse waits 900ms away and respects draft/action/keep-open protection', () => {
  const hover = new Proximity(); const bounds = { x: 100, y: 100, width: 376, height: 548 };
  assert.equal(hover.tick(0, { x: 0, y: 0 }, bounds, true, false), null);
  assert.equal(hover.tick(899, { x: 0, y: 0 }, bounds, true, false), null);
  assert.equal(hover.tick(900, { x: 0, y: 0 }, bounds, true, false), 'collapse');
  assert.equal(hover.tick(2000, { x: 0, y: 0 }, bounds, true, true), null);
  assert.equal(hover.tick(9999, { x: 0, y: 0 }, bounds, true, true), null);
  assert.equal(hover.tick(10000, { x: 0, y: 0 }, bounds, true, false), null);
  assert.equal(hover.tick(10900, { x: 0, y: 0 }, bounds, true, false), 'collapse');
});
test('summoning beside the cursor clamps to the correct monitor work area', () => {
  assert.deepEqual(cursorBounds({ x: -1280, y: 0, width: 1280, height: 960 }, { x: -20, y: 900 }), { x: -376, y: 412, width: 376, height: 548 });
  assert.deepEqual(cursorBounds({ x: 100, y: 200, width: 300, height: 400 }, { x: 110, y: 210 }), { x: 100, y: 200, width: 300, height: 400 });
  assert.deepEqual(cursorBounds({ x: 0, y: 0, width: 1920, height: 1080 }, { x: 200, y: 300 }), { x: 212, y: 312, width: 376, height: 548 });
});
