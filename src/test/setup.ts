import '@testing-library/jest-dom';
import { vi } from 'vitest';

// In the test (jsdom) environment there is no native SQLite plugin, so the data
// layer transparently falls back to its localStorage-backed store, which jsdom
// provides. No database mocking is required.

// Mock window.location.reload (used by clearAllData).
delete (window as unknown as { location?: unknown }).location;
(window as unknown as { location: { reload: () => void } }).location = { reload: vi.fn() } as unknown as Location;

// Mock navigator.serviceWorker.
if (typeof navigator !== 'undefined') {
  Object.assign(navigator, {
    serviceWorker: {
      register: vi.fn().mockResolvedValue({}),
      unregister: vi.fn().mockResolvedValue(undefined),
    },
  });
}
