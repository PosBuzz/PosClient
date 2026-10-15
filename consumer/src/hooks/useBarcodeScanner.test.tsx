import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBarcodeScanner } from "./useBarcodeScanner";

let now = 1_000_000;
const press = (key: string, gap = 10) => {
  now += gap;
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(event);
  return event;
};
const scan = (code: string) => {
  press(code[0], 500);
  for (const ch of code.slice(1)) press(ch, 10);
};

beforeEach(() => {
  vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => {
  document.body.innerHTML = "";
  (document.activeElement as HTMLElement | null)?.blur?.();
});

const setup = (
  extra: Partial<Parameters<typeof useBarcodeScanner>[0]> = {},
) => {
  const onBarcodeScanned = vi.fn();
  const onSubmit = vi.fn();
  const hook = renderHook((props) => useBarcodeScanner(props), {
    initialProps: { selectedBranch: 1, onBarcodeScanned, onSubmit, ...extra },
  });
  return { onBarcodeScanned, onSubmit, ...hook };
};

describe("useBarcodeScanner", () => {
  it("[CO-HOOK-003] fast keystrokes followed by Enter are one scan, delivered once", () => {
    const { onBarcodeScanned, onSubmit } = setup();
    scan("ABC-123");
    const enter = press("Enter");
    expect(onBarcodeScanned).toHaveBeenCalledTimes(1);
    expect(onBarcodeScanned).toHaveBeenCalledWith("ABC-123");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(true);
  });

  it("[CO-HOOK-003] the buffer is emptied after a scan, so the next scan is not prefixed", () => {
    const { onBarcodeScanned } = setup();
    scan("111");
    press("Enter");
    scan("222");
    press("Enter");
    expect(onBarcodeScanned.mock.calls.map((c) => c[0])).toEqual([
      "111",
      "222",
    ]);
  });

  it("[CO-HOOK-003] a slow human keystroke is not a scan, and a lone Enter submits the form", () => {
    const { onBarcodeScanned, onSubmit } = setup();
    press("a", 500);
    press("Enter", 500);
    expect(onBarcodeScanned).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("[CO-HOOK-003] a pause longer than 100ms starts a new buffer", () => {
    const { onBarcodeScanned } = setup();
    scan("OLD");
    press("N", 500);
    press("Enter", 10);
    expect(onBarcodeScanned).toHaveBeenCalledWith("N");
  });

  it("[CO-HOOK-003] keystrokes into an input field are ignored", () => {
    const { onBarcodeScanned, onSubmit } = setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    for (const ch of "ABC") {
      now += 10;
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: ch, bubbles: true }),
      );
    }
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(onBarcodeScanned).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("[CO-HOOK-003] disabled does nothing; switching branch clears a half-typed buffer", () => {
    const off = setup({ enabled: false });
    scan("XYZ");
    press("Enter");
    expect(off.onBarcodeScanned).not.toHaveBeenCalled();
    expect(off.onSubmit).not.toHaveBeenCalled();
    off.unmount();

    const on = setup();
    scan("HALF");
    on.rerender({
      selectedBranch: 2,
      onBarcodeScanned: on.onBarcodeScanned,
      onSubmit: on.onSubmit,
    });
    press("Enter", 10);
    expect(on.onBarcodeScanned).not.toHaveBeenCalled();
    expect(on.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("[CO-HOOK-003] uses the latest callbacks without re-subscribing, and removes its listener on unmount", () => {
    const first = vi.fn();
    const second = vi.fn();
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const view = renderHook(
      (cb: (b: string) => void) =>
        useBarcodeScanner({
          selectedBranch: 1,
          onBarcodeScanned: cb,
          onSubmit: vi.fn(),
        }),
      { initialProps: first },
    );
    view.rerender(second);
    scan("ZZ");
    press("Enter");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("ZZ");
    view.unmount();
    expect(removeSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
      true,
    );
  });
});
