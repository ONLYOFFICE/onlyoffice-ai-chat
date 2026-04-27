// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type React from "react";

// ── PlatformProvider / usePlatform ──────────────────────────────────────────

import { PlatformProvider, usePlatform } from "../platform/context";

describe("PlatformProvider / usePlatform", () => {
  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => usePlatform());
    }).toThrow("usePlatform() must be used inside <PlatformProvider>");
  });

  it("returns the platform value when inside provider", () => {
    const mockPlatform = { env: { locale: "en" } } as never;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlatformProvider platform={mockPlatform}>{children}</PlatformProvider>
    );
    const { result } = renderHook(() => usePlatform(), { wrapper });
    expect(result.current).toBe(mockPlatform);
  });
});

// ── SettingsProvider / useSettings ──────────────────────────────────────────

import { SettingsProvider, useSettings } from "../settings/context";

describe("SettingsProvider / useSettings", () => {
  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useSettings());
    }).toThrow("useSettings() must be used inside <SettingsProvider>");
  });

  it("returns the settings value when inside provider", () => {
    const mockSettings = {
      get: vi.fn(),
      set: vi.fn(),
    } as never;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider settings={mockSettings}>{children}</SettingsProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current).toBe(mockSettings);
  });
});

// ── StoresProvider / useStores ──────────────────────────────────────────────

import { StoresProvider, useStores } from "../store/context";

describe("StoresProvider / useStores", () => {
  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useStores());
    }).toThrow("useStores must be used within a StoresProvider");
  });

  it("returns the stores value when inside provider", () => {
    const mockStores = {
      useRouter: vi.fn(),
      useThreadsStore: vi.fn(),
    } as never;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StoresProvider stores={mockStores}>{children}</StoresProvider>
    );
    const { result } = renderHook(() => useStores(), { wrapper });
    expect(result.current).toBe(mockStores);
  });
});

// ── ToolsProvider / useToolsContext ─────────────────────────────────────────

import { ToolsProvider, useToolsContext } from "../tools/context";

describe("ToolsProvider / useToolsContext", () => {
  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useToolsContext());
    }).toThrow("useToolsContext() must be used inside <ToolsProvider>");
  });

  it("returns context value when inside provider", () => {
    const mockServers = {
      hostToolSource: { setGroups: vi.fn() },
    } as never;
    const mockEventBus = {} as never;
    const hostToolGroups: never[] = [];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToolsProvider
        hostToolGroups={hostToolGroups}
        servers={mockServers}
        eventBus={mockEventBus}
      >
        {children}
      </ToolsProvider>
    );
    const { result } = renderHook(() => useToolsContext(), { wrapper });
    expect(result.current.servers).toBe(mockServers);
    expect(result.current.eventBus).toBe(mockEventBus);
    expect(result.current.hostToolGroups).toBe(hostToolGroups);
  });

  it("syncs host tool groups into servers on mount", () => {
    const setGroups = vi.fn();
    const mockServers = {
      hostToolSource: { setGroups },
    } as never;
    const mockEventBus = {} as never;
    const groups = [{ id: "g1", tools: [] }] as never[];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToolsProvider
        hostToolGroups={groups}
        servers={mockServers}
        eventBus={mockEventBus}
      >
        {children}
      </ToolsProvider>
    );
    renderHook(() => useToolsContext(), { wrapper });
    expect(setGroups).toHaveBeenCalledWith(groups);
  });
});

// ── StorageProvider / useStorage ────────────────────────────────────────────

vi.mock("../shared/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { StorageProvider, useStorage } from "../storage/context";

describe("StorageProvider / useStorage", () => {
  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useStorage());
    }).toThrow("useStorage() must be used inside <StorageProvider>");
  });

  it("renders children only after storage.init() resolves", async () => {
    const mockStorage = {
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    } as never;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StorageProvider storage={mockStorage}>{children}</StorageProvider>
    );

    const { result } = renderHook(() => useStorage(), { wrapper });
    await waitFor(() => {
      expect(result.current).toBe(mockStorage);
    });
  });

  it("does not render children while init is pending", () => {
    let resolveInit: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    const mockStorage = {
      init: vi.fn().mockReturnValue(initPromise),
      close: vi.fn(),
    } as never;

    let hookCalled = false;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StorageProvider storage={mockStorage}>{children}</StorageProvider>
    );

    const { result: _result } = renderHook(
      () => {
        hookCalled = true;
        return useStorage();
      },
      { wrapper }
    );

    // Hook should not have been called because children not rendered yet
    expect(hookCalled).toBe(false);

    // Cleanup: resolve the promise
    act(() => {
      resolveInit!();
    });
  });

  it("calls storage.close() on unmount", async () => {
    const mockStorage = {
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    } as never;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StorageProvider storage={mockStorage}>{children}</StorageProvider>
    );

    const { unmount } = renderHook(() => useStorage(), { wrapper });
    await waitFor(() => {
      expect(
        (mockStorage as { init: ReturnType<typeof vi.fn> }).init
      ).toHaveBeenCalled();
    });

    unmount();
    expect(
      (mockStorage as { close: ReturnType<typeof vi.fn> }).close
    ).toHaveBeenCalled();
  });

  it("logs error when storage.init() fails", async () => {
    const logger = (await import("../shared/logger")).default;
    const mockStorage = {
      init: vi.fn().mockRejectedValue(new Error("init failed")),
      close: vi.fn(),
    } as never;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StorageProvider storage={mockStorage}>{children}</StorageProvider>
    );

    renderHook(
      () => {
        try {
          return useStorage();
        } catch {
          return null;
        }
      },
      { wrapper }
    );

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        "Storage init failed:",
        expect.any(Error)
      );
    });
  });
});
