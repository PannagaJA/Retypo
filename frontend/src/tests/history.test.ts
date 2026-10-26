import { describe, it, expect } from 'vitest';
import { HistoryManager } from '../utils/history';
import type { TextLayer } from '../types';

describe('HistoryManager (Undo / Redo)', () => {
  const layer1: TextLayer = {
    id: 'layer-1',
    text: 'Hello World',
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '400',
    fontStyle: 'normal',
    fill: '#ffffff',
    strokeWidth: 0,
    letterSpacing: 0,
    lineHeight: 1.2,
    textAlign: 'left',
    left: 100,
    top: 100,
    width: 200,
    height: 40,
    angle: 0,
    opacity: 1,
    isLocked: false,
    isVisible: true,
    origin: 'manual',
  };

  const layer2: TextLayer = {
    ...layer1,
    id: 'layer-2',
    text: 'Second Line',
    top: 200,
  };

  it('starts empty with canUndo and canRedo false', () => {
    const history = new HistoryManager();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('pushes state and enables undo', () => {
    const history = new HistoryManager();
    history.pushState([layer1]);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('undo reverts to previous state and enables redo', () => {
    const history = new HistoryManager();
    // State 0: [layer1]
    history.pushState([layer1]);

    // Current is [layer1, layer2]
    const current = [layer1, layer2];
    const undone = history.undo(current);

    expect(undone).toEqual([layer1]);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    // Redo restores current state
    const redone = history.redo([layer1]);
    expect(redone).toEqual([layer1, layer2]);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('clears redo stack on new push', () => {
    const history = new HistoryManager();
    history.pushState([layer1]);
    history.undo([layer1, layer2]);
    expect(history.canRedo()).toBe(true);

    history.pushState([layer2]);
    expect(history.canRedo()).toBe(false);
  });

  it('respects max depth bounds', () => {
    const history = new HistoryManager(3);
    history.pushState([{ ...layer1, text: 'v1' }]);
    history.pushState([{ ...layer1, text: 'v2' }]);
    history.pushState([{ ...layer1, text: 'v3' }]);
    history.pushState([{ ...layer1, text: 'v4' }]);

    // Only 3 states should be in undo stack
    expect(history.canUndo()).toBe(true);
    const u1 = history.undo([{ ...layer1, text: 'v5' }]);
    expect(u1?.[0].text).toBe('v4');
    const u2 = history.undo([{ ...layer1, text: 'v4' }]);
    expect(u2?.[0].text).toBe('v3');
    const u3 = history.undo([{ ...layer1, text: 'v3' }]);
    expect(u3?.[0].text).toBe('v2');
    expect(history.canUndo()).toBe(false);
  });

  it('correctly handles full EditorSnapshot with inpaint patches and converted regions', () => {
    const history = new HistoryManager();

    const snapshot0 = {
      layers: [],
      inpaintPatches: [],
      convertedRegionIds: [],
    };

    const snapshot1 = {
      layers: [layer1],
      inpaintPatches: [
        {
          id: 'patch-layer-1',
          bounds: { left: 100, top: 100, width: 200, height: 40 },
          dataUrl: 'data:image/png;base64,patchdata',
          strategy: 'telea',
        },
      ],
      convertedRegionIds: ['region-1'],
    };

    history.pushState(snapshot0);
    expect(history.canUndo()).toBe(true);

    // Undo from snapshot1 back to snapshot0
    const undone = history.undo(snapshot1);
    expect(undone).toEqual(snapshot0);
    expect(undone?.layers).toHaveLength(0);
    expect(undone?.inpaintPatches).toHaveLength(0);
    expect(undone?.convertedRegionIds).toHaveLength(0);

    // Redo restores snapshot1 with inpaint patch and converted region ID
    const redone = history.redo(snapshot0);
    expect(redone).toEqual(snapshot1);
    expect(redone?.layers).toHaveLength(1);
    expect(redone?.inpaintPatches?.[0].id).toBe('patch-layer-1');
    expect(redone?.convertedRegionIds).toContain('region-1');
  });
});
