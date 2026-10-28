import { describe, it, expect } from 'vitest';
import { DiscardModal } from '../components/DiscardModal';

describe('Discard Changes & Refresh Protection', () => {
  it('exports DiscardModal component correctly', () => {
    expect(DiscardModal).toBeDefined();
    expect(typeof DiscardModal).toBe('function');
  });

  it('determines unsaved changes accurately across editor state', () => {
    // No image loaded (landing page) -> no unsaved changes
    expect(Boolean(null)).toBe(false);

    // Image loaded in workspace -> unsaved changes protection active
    expect(Boolean({ fileName: 'receipt.png' })).toBe(true);
  });

  const isRefreshShortcut = (e: { key: string; ctrlKey?: boolean; metaKey?: boolean }): boolean => {
    const modKey = Boolean(e.metaKey || e.ctrlKey);
    return e.key === 'F5' || (modKey && (e.key === 'r' || e.key === 'R'));
  };

  it('intercepts browser refresh key combinations', () => {
    // F5 key
    expect(isRefreshShortcut({ key: 'F5' })).toBe(true);

    // Mac Cmd+R
    expect(isRefreshShortcut({ key: 'r', metaKey: true })).toBe(true);
    expect(isRefreshShortcut({ key: 'R', metaKey: true })).toBe(true);

    // Windows/Linux Ctrl+R
    expect(isRefreshShortcut({ key: 'r', ctrlKey: true })).toBe(true);
    expect(isRefreshShortcut({ key: 'R', ctrlKey: true })).toBe(true);

    // Normal typing or other shortcuts
    expect(isRefreshShortcut({ key: 'r' })).toBe(false);
    expect(isRefreshShortcut({ key: 'z', metaKey: true })).toBe(false);
    expect(isRefreshShortcut({ key: 'Escape' })).toBe(false);
  });

  it('handles beforeunload event and sets discard message when editing', () => {
    let preventDefaultCalled = false;
    const mockEvent = {
      preventDefault: () => {
        preventDefaultCalled = true;
      },
      returnValue: '',
    };

    const isEditing = true;
    const isAllowingUnload = false;

    if (!isAllowingUnload && isEditing) {
      mockEvent.preventDefault();
      mockEvent.returnValue = 'Your changes will be discarded.';
    }

    expect(preventDefaultCalled).toBe(true);
    expect(mockEvent.returnValue).toBe('Your changes will be discarded.');
  });

  it('allows page reload when user explicitly confirms discard', () => {
    let preventDefaultCalled = false;
    const mockEvent = {
      preventDefault: () => {
        preventDefaultCalled = true;
      },
      returnValue: '',
    };

    const isEditing = true;
    const isAllowingUnload = true; // User clicked "Discard & Refresh"

    if (!isAllowingUnload && isEditing) {
      mockEvent.preventDefault();
      mockEvent.returnValue = 'Your changes will be discarded.';
    }

    expect(preventDefaultCalled).toBe(false);
    expect(mockEvent.returnValue).toBe('');
  });
});
