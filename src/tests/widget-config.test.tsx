// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, renderHook } from "@testing-library/react";
import {
  WidgetConfigProvider,
  useWidgetConfig,
} from "../widget-config";

describe("WidgetConfigProvider", () => {
  it("returns empty config when no provider is wrapping the tree", () => {
    const { result } = renderHook(() => useWidgetConfig());
    expect(result.current).toEqual({});
  });

  it("exposes provided config through useWidgetConfig", () => {
    const config = { hideSettingsButton: true, isDialogFullscreen: true };
    const { result } = renderHook(() => useWidgetConfig(), {
      wrapper: ({ children }) => (
        <WidgetConfigProvider config={config}>{children}</WidgetConfigProvider>
      ),
    });
    expect(result.current).toEqual(config);
  });

  it("falls back to {} when config prop is undefined", () => {
    const { result } = renderHook(() => useWidgetConfig(), {
      wrapper: ({ children }) => (
        <WidgetConfigProvider>{children}</WidgetConfigProvider>
      ),
    });
    expect(result.current).toEqual({});
  });

  it("renders children", () => {
    const { getByText } = render(
      <WidgetConfigProvider>
        <span>child</span>
      </WidgetConfigProvider>
    );
    expect(getByText("child")).toBeInTheDocument();
  });

  it("exposes assistantActions through useWidgetConfig", () => {
    const onClick = () => {};
    const config = {
      assistantActions: [
        { id: "translate", tooltip: "Translate", icon: "btn-copy", onClick },
      ],
    };
    const { result } = renderHook(() => useWidgetConfig(), {
      wrapper: ({ children }) => (
        <WidgetConfigProvider config={config}>{children}</WidgetConfigProvider>
      ),
    });
    expect(result.current.assistantActions).toHaveLength(1);
    expect(result.current.assistantActions?.[0].id).toBe("translate");
    expect(result.current.assistantActions?.[0].onClick).toBe(onClick);
  });
});
