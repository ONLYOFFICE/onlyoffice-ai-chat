// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useCopyToClipboard from "../hooks/useCopyToClipboard";

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns isCopied as false initially", () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.isCopied).toBe(false);
  });

  it("sets isCopied to true after copying", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard("hello");
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
    expect(result.current.isCopied).toBe(true);
  });

  it("resets isCopied after default duration (3000ms)", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard("hello");
    });

    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isCopied).toBe(false);
  });

  it("resets isCopied after custom duration", async () => {
    const { result } = renderHook(() =>
      useCopyToClipboard({ copiedDuration: 1000 })
    );

    await act(async () => {
      result.current.copyToClipboard("text");
    });

    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.isCopied).toBe(false);
  });

  it("does nothing when value is empty", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard("");
    });

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(result.current.isCopied).toBe(false);
  });
});
