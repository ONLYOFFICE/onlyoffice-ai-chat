// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, renderHook } from "@testing-library/react";
import { ComponentsProvider, useComponents } from "../context";
import { defaultComponents } from "../defaults";

const Stub = () => <span>stub</span>;

describe("ComponentsProvider", () => {
  it("returns defaults when no overrides provided", () => {
    const { result } = renderHook(() => useComponents(), {
      wrapper: ({ children }) => (
        <ComponentsProvider>{children}</ComponentsProvider>
      ),
    });
    expect(result.current).toBe(defaultComponents);
  });

  it("merges overrides with defaults", () => {
    const overrides = { Button: Stub } as never;
    const { result } = renderHook(() => useComponents(), {
      wrapper: ({ children }) => (
        <ComponentsProvider overrides={overrides}>
          {children}
        </ComponentsProvider>
      ),
    });
    expect(result.current.Button).toBe(Stub);
  });

  it("renders children", () => {
    const { getByText } = render(
      <ComponentsProvider>
        <span>child</span>
      </ComponentsProvider>
    );
    expect(getByText("child")).toBeInTheDocument();
  });
});
