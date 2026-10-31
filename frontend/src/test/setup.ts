import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not implement canvas drawing (getContext returns null), but the
// landing page animates on a canvas. Every call or property read on this
// stand-in returns another stand-in, so drawing code (including gradients)
// runs without doing anything.
const noop = (): unknown =>
  new Proxy(() => undefined, {
    get: () => noop,
    apply: () => noop(),
  });

HTMLCanvasElement.prototype.getContext = vi.fn(
  noop,
) as unknown as HTMLCanvasElement["getContext"];

// jsdom does not implement ResizeObserver; the landing page observes canvas size.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver;

// Reset rendered React trees and browser storage between tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
