// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";
import { PlatformProvider, usePlatform } from "../context";
import type { PlatformAdapter } from "../types";

const platform = {
  file: null,
  process: null,
  hostTools: null,
  clouds: null,
  env: {
    theme: "light",
    systemTheme: "light",
    locale: "en",
    devicePixelRatio: 1,
  },
} as PlatformAdapter;

describe("platform context", () => {
  it("usePlatform throws when used outside PlatformProvider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => usePlatform())).toThrow(
      "usePlatform() must be used inside <PlatformProvider>"
    );
    errorSpy.mockRestore();
  });

  it("usePlatform returns the platform from context", () => {
    const { result } = renderHook(() => usePlatform(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform={platform}>{children}</PlatformProvider>
      ),
    });
    expect(result.current).toBe(platform);
  });

  it("PlatformProvider renders children", () => {
    const { getByText } = render(
      <PlatformProvider platform={platform}>
        <span>child</span>
      </PlatformProvider>
    );
    expect(getByText("child")).toBeInTheDocument();
  });
});
