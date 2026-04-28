// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";
import { StoresProvider, useStores } from "../context";
import type { Stores } from "../create-stores";

describe("store context", () => {
  it("useStores throws outside StoresProvider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useStores())).toThrow(
      "useStores must be used within a StoresProvider"
    );
    errorSpy.mockRestore();
  });

  it("useStores returns the stores from context", () => {
    const stores = { tag: "value" } as unknown as Stores;
    const { result } = renderHook(() => useStores(), {
      wrapper: ({ children }) => (
        <StoresProvider stores={stores}>{children}</StoresProvider>
      ),
    });
    expect(result.current).toBe(stores);
  });

  it("StoresProvider renders children", () => {
    const stores = {} as Stores;
    const { getByText } = render(
      <StoresProvider stores={stores}>
        <span>child</span>
      </StoresProvider>
    );
    expect(getByText("child")).toBeInTheDocument();
  });
});
