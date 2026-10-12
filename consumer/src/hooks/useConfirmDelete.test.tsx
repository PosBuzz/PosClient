import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useModalStore } from "../stores/modalStore";
import { useConfirmDelete } from "./useConfirmDelete";

const fakeModal = () => ({ confirm: vi.fn(), error: vi.fn() }) as any;

afterEach(() => useModalStore.setState({ modal: null }));

describe("useConfirmDelete", () => {
  it("[CO-HOOK-004] asks for confirmation with a danger button and only deletes after Yes", async () => {
    const modal = fakeModal();
    useModalStore.setState({ modal });
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConfirmDelete({
        title: "Delete?",
        content: "Gone forever",
        onConfirm,
      }),
    );
    act(() => result.current.showDeleteConfirm());
    const opts = modal.confirm.mock.calls[0][0];
    expect(opts).toMatchObject({
      title: "Delete?",
      content: "Gone forever",
      okText: "Yes",
      okType: "danger",
      cancelText: "No",
    });
    expect(onConfirm).not.toHaveBeenCalled();
    await opts.onOk();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(modal.error).not.toHaveBeenCalled();
  });

  it("[CO-HOOK-004] shows an error dialog when the delete fails, and passes Cancel through", async () => {
    const modal = fakeModal();
    useModalStore.setState({ modal });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useConfirmDelete({
        title: "t",
        content: "c",
        onConfirm: () => Promise.reject(new Error("boom")),
        onCancel,
      }),
    );
    act(() => result.current.showDeleteConfirm());
    const opts = modal.confirm.mock.calls[0][0];
    await opts.onOk();
    expect(modal.error).toHaveBeenCalledWith({
      title: "Operation Failed",
      content: "Failed to delete. Please try again later.",
    });
    opts.onCancel();
    expect(onCancel).toHaveBeenCalled();
  });

  it("[CO-HOOK-004] does nothing before the modal host is registered", () => {
    const { result } = renderHook(() =>
      useConfirmDelete({ title: "t", content: "c", onConfirm: vi.fn() }),
    );
    expect(() => result.current.showDeleteConfirm()).not.toThrow();
  });
});
