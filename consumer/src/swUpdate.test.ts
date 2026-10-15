import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerChunkErrorReload } from "./swUpdate";

describe("registerChunkErrorReload", () => {
  const reload = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T10:00:00Z"));
    sessionStorage.clear();
    reload.mockClear();
    vi.stubGlobal("location", { ...window.location, reload });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Listeners accumulate across tests on the shared window, so register once.
  registerChunkErrorReload();

  const firePreloadError = () => {
    const event = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(event);
    return event;
  };

  it("reloads once and suppresses the error when a stale chunk fails to load", () => {
    const event = firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(sessionStorage.getItem("chunk-reload-at")).toBe(String(Date.now()));
  });

  it("does not reload again within the cooldown, so an offline chunk cannot loop", () => {
    firePreloadError();
    vi.advanceTimersByTime(9_999);
    const second = firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
  });

  it("reloads again once the cooldown has passed", () => {
    firePreloadError();
    vi.advanceTimersByTime(10_000);
    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(2);
  });
});
