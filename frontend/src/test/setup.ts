import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not implement canvas drawing (getContext returns null), but the
// landing page animates on a canvas. Every call or property read on this
// stand-in returns another stand-in, so drawing code (including gradients)
// runs without doing anything.
const noop = (): unknown =>
  new Proxy(() => undefined, { get: () => noop, apply: () => noop() });

HTMLCanvasElement.prototype.getContext = vi.fn(
  noop,
) as unknown as HTMLCanvasElement["getContext"];

// jsdom has no ResizeObserver either; the landing page watches its canvas size.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver;

// Vitest globals are off, so Testing Library cannot register its own cleanup.
// Unmount rendered trees and clear browser storage so every test starts clean.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
