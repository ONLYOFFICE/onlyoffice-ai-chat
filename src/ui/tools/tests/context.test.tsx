// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";
import { ToolsProvider, useToolsContext } from "../context";
import type Servers from "../servers";
import type { ChatEventBus } from "../../providers/EventsProvider";
import type { HostToolGroup } from "../types";

const setGroups = vi.fn();
const servers = { hostToolSource: { setGroups } } as unknown as Servers;
const eventBus = {} as ChatEventBus;
const hostToolGroups: HostToolGroup[] = [];

describe("tools context", () => {
  it("useToolsContext throws outside provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useToolsContext())).toThrow(
      "useToolsContext() must be used inside <ToolsProvider>"
    );
    errorSpy.mockRestore();
  });

  it("useToolsContext returns context value", () => {
    const { result } = renderHook(() => useToolsContext(), {
      wrapper: ({ children }) => (
        <ToolsProvider
          hostToolGroups={hostToolGroups}
          servers={servers}
          eventBus={eventBus}
        >
          {children}
        </ToolsProvider>
      ),
    });
    expect(result.current.servers).toBe(servers);
    expect(result.current.eventBus).toBe(eventBus);
  });

  it("ToolsProvider syncs host tool groups into servers", () => {
    setGroups.mockClear();
    const groups: HostToolGroup[] = [
      { id: "g", name: "G", tools: [] },
    ] as HostToolGroup[];
    render(
      <ToolsProvider hostToolGroups={groups} servers={servers} eventBus={eventBus}>
        <span>x</span>
      </ToolsProvider>
    );
    expect(setGroups).toHaveBeenCalledWith(groups);
  });
});
