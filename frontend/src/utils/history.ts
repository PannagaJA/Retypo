import type { TextLayer, InpaintPatch } from '../types';

export interface EditorSnapshot {
  layers: TextLayer[];
  inpaintPatches?: InpaintPatch[];
  convertedRegionIds?: string[];
}

export class HistoryManager<T = any> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];
  private maxDepth: number;

  constructor(maxDepth: number = 50) {
    this.maxDepth = maxDepth;
  }

  public pushState(state: T) {
    // Clone state deeply to prevent reference mutation
    const snapshot = JSON.parse(JSON.stringify(state));
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    // Clear redo on new action
    this.redoStack = [];
  }

  public undo(currentState: T): T | null {
    if (this.undoStack.length === 0) return null;
    const current = JSON.parse(JSON.stringify(currentState));
    this.redoStack.push(current);
    return this.undoStack.pop() || null;
  }

  public redo(currentState: T): T | null {
    if (this.redoStack.length === 0) return null;
    const current = JSON.parse(JSON.stringify(currentState));
    this.undoStack.push(current);
    return this.redoStack.pop() || null;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
