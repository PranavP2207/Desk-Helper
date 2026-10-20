export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export interface Rect { x: number; y: number; width: number; height: number }
export interface WidgetState {
  expanded: boolean; keepOpen: boolean; nearCursor?: boolean; corner: Corner; displayId: string;
  displays: { id: string; label: string }[];
}
export const DOT_SIZE = 64;
export const PANEL_SIZE = { width: 376, height: 548 };

export function cornerBounds(workArea: Rect, corner: Corner, expanded: boolean): Rect {
  const margin = Math.min(14, Math.floor(Math.min(workArea.width, workArea.height) / 10));
  const width = Math.min(expanded ? PANEL_SIZE.width : DOT_SIZE, workArea.width - margin * 2);
  const height = Math.min(expanded ? PANEL_SIZE.height : DOT_SIZE, workArea.height - margin * 2);
  return { x: corner.endsWith('right') ? workArea.x + workArea.width - width - margin : workArea.x + margin,
    y: corner.startsWith('bottom') ? workArea.y + workArea.height - height - margin : workArea.y + margin, width, height };
}

export function validCorner(value: unknown): Corner {
  if (!['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(value as string)) throw new Error('Choose a screen corner.');
  return value as Corner;
}

export class Proximity {
  private nearSince: number | null = null;
  private awaySince: number | null = null;
  reset() { this.nearSince = null; this.awaySince = null; }
  tick(now: number, cursor: { x: number; y: number }, bounds: Rect, expanded: boolean, protectedInteraction: boolean): 'expand' | 'collapse' | null {
    const padding = expanded ? 5 : 14;
    const near = cursor.x >= bounds.x - padding && cursor.x <= bounds.x + bounds.width + padding && cursor.y >= bounds.y - padding && cursor.y <= bounds.y + bounds.height + padding;
    if (!expanded) {
      this.awaySince = null;
      if (!near) { this.nearSince = null; return null; }
      this.nearSince ??= now;
      if (now - this.nearSince >= 300) { this.reset(); return 'expand'; }
    } else {
      this.nearSince = null;
      if (near || protectedInteraction) { this.awaySince = null; return null; }
      this.awaySince ??= now;
      if (now - this.awaySince >= 900) { this.reset(); return 'collapse'; }
    }
    return null;
  }
}

export function cursorBounds(workArea: Rect, cursor: { x: number; y: number }): Rect {
  const width = Math.min(PANEL_SIZE.width, workArea.width), height = Math.min(PANEL_SIZE.height, workArea.height);
  return { x: Math.max(workArea.x, Math.min(cursor.x + 12, workArea.x + workArea.width - width)), y: Math.max(workArea.y, Math.min(cursor.y + 12, workArea.y + workArea.height - height)), width, height };
}
