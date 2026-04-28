// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";

const { getImageSrcInternal, getProviderImageSrcInternal } = vi.hoisted(() => ({
  getImageSrcInternal: vi.fn(() => ({ src: "default.svg", isSvg: true })),
  getProviderImageSrcInternal: vi.fn(() => "default-provider.png"),
}));

vi.mock("../../../../shared/images", () => ({
  getImageSrc: getImageSrcInternal,
  getProviderImageSrc: getProviderImageSrcInternal,
}));

import { ImagesProvider, useImages } from "../context";

describe("ImagesProvider", () => {
  it("falls back to default images when no overrides", () => {
    const { result } = renderHook(() => useImages(), {
      wrapper: ({ children }) => <ImagesProvider>{children}</ImagesProvider>,
    });
    expect(result.current.getImageSrc("logo" as never, "light", 1)).toEqual({
      src: "default.svg",
      isSvg: true,
    });
    expect(result.current.getIconComponent("logo" as never)).toBeNull();
    expect(result.current.getProviderImageSrc("openai")).toBe(
      "default-provider.png"
    );
  });

  it("uses string override for getImageSrc", () => {
    const { result } = renderHook(() => useImages(), {
      wrapper: ({ children }) => (
        <ImagesProvider
          overrides={{ logo: "/cdn/logo.png" } as never}
        >
          {children}
        </ImagesProvider>
      ),
    });
    expect(result.current.getImageSrc("logo" as never, "light", 1)).toEqual({
      src: "/cdn/logo.png",
      isSvg: false,
    });
  });

  it("detects svg in string override", () => {
    const { result } = renderHook(() => useImages(), {
      wrapper: ({ children }) => (
        <ImagesProvider overrides={{ logo: "/cdn/logo.svg" } as never}>
          {children}
        </ImagesProvider>
      ),
    });
    expect(result.current.getImageSrc("logo" as never, "light", 1).isSvg).toBe(
      true
    );
  });

  it("uses theme function override for getImageSrc", () => {
    const themeFn = vi.fn(
      (theme: "light" | "dark", scale: number) => `/img-${theme}-${scale}x.png`
    );
    const { result } = renderHook(() => useImages(), {
      wrapper: ({ children }) => (
        <ImagesProvider overrides={{ logo: themeFn } as never}>
          {children}
        </ImagesProvider>
      ),
    });
    expect(result.current.getImageSrc("logo" as never, "dark", 2)).toEqual({
      src: "/img-dark-2x.png",
      isSvg: false,
    });
    expect(themeFn).toHaveBeenCalledWith("dark", 2);
  });

  it("returns null from getImageSrc when override is a component", () => {
    const Comp = (props: { size?: number; className?: string }) =>
      React.createElement("svg", props);
    const { result } = renderHook(() => useImages(), {
      wrapper: ({ children }) => (
        <ImagesProvider overrides={{ logo: Comp } as never}>
          {children}
        </ImagesProvider>
      ),
    });
    expect(result.current.getImageSrc("logo" as never, "light", 1)).toBeNull();
    expect(result.current.getIconComponent("logo" as never)).toBe(Comp);
  });

  it("getIconComponent returns null when override is not a component", () => {
    const { result } = renderHook(() => useImages(), {
      wrapper: ({ children }) => (
        <ImagesProvider overrides={{ logo: "/x.png" } as never}>
          {children}
        </ImagesProvider>
      ),
    });
    expect(result.current.getIconComponent("logo" as never)).toBeNull();
  });

  it("getProviderImageSrc honours string and theme function overrides", () => {
    const themeFn = vi.fn(
      (theme: "light" | "dark", scale: number) => `/p-${theme}-${scale}.png`
    );
    const { result } = renderHook(() => useImages(), {
      wrapper: ({ children }) => (
        <ImagesProvider
          overrides={
            {
              openai: "/openai.png",
              anthropic: themeFn,
            } as never
          }
        >
          {children}
        </ImagesProvider>
      ),
    });
    expect(result.current.getProviderImageSrc("openai")).toBe("/openai.png");
    expect(result.current.getProviderImageSrc("anthropic", "dark", 2)).toBe(
      "/p-dark-2.png"
    );
    expect(result.current.getProviderImageSrc("missing")).toBe(
      "default-provider.png"
    );
  });

  it("renders children", () => {
    const { getByText } = render(
      <ImagesProvider>
        <span>child</span>
      </ImagesProvider>
    );
    expect(getByText("child")).toBeInTheDocument();
  });
});
