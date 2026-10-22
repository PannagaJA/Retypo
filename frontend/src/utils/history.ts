import type { TextLayer } from '../types';

export class HistoryManager {
  private undoStack: TextLayer[][] = [];
  private redoStack: TextLayer[][] = [];
  private maxDepth: number;

  constructor(maxDepth: number = 50) {
    this.maxDepth = maxDepth;
  }

  public pushState(layers: TextLayer[]) {
    // Clone layers deeply
    const snapshot = JSON.parse(JSON.stringify(layers));
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    // Clear redo on new action
    this.redoStack = [];
  }

  public undo(currentLayers: TextLayer[]): TextLayer[] | null {
    if (this.undoStack.length === 0) return null;
    const currentState = JSON.parse(JSON.stringify(currentLayers));
    this.redoStack.push(currentState);
    return this.undoStack.pop() || null;
  }

  public redo(currentLayers: TextLayer[]): TextLayer[] | null {
    if (this.redoStack.length === 0) return null;
    const currentState = JSON.parse(JSON.stringify(currentLayers));
    this.undoStack.push(currentState);
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
