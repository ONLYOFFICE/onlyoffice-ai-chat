// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock i18n initialization
const mockInitI18n = vi.fn().mockResolvedValue(undefined);
vi.mock("../locales/i18n", () => ({
  initAIChatI18n: (...args: unknown[]) => mockInitI18n(...args),
}));

vi.mock("../locales", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useI18n: () => ({
    t: (k: string) => k,
    locale: "en",
    changeLocale: vi.fn(),
    isRTL: false,
    direction: "ltr" as const,
  }),
  initAIChatI18n: (...args: unknown[]) => mockInitI18n(...args),
  bundledLocaleKeys: ["en"],
}));

// Mock logger
vi.mock("../lib/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock Provider class - must be a real class
vi.mock("../providers", () => ({
  default: class MockProvider {
    setSettings = vi.fn();
  },
}));

// Mock Servers class - must be a real class
vi.mock("../tools/servers", () => ({
  default: class MockServers {
    hostToolSource = { setGroups: vi.fn() };
  },
}));

// Mock ChatEventBus - must be a real class
vi.mock("../events", () => ({
  ChatEventBus: class MockEventBus {},
}));

// Mock global holders
vi.mock("../providers/provider-holder", () => ({
  setProviderInstance: vi.fn(),
}));
vi.mock("../settings/settings-holder", () => ({
  setSettingsInstance: vi.fn(),
}));
vi.mock("../storage/storage-holder", () => ({
  setStorageInstance: vi.fn(),
}));
vi.mock("../tools/tools-holder", () => ({
  setServersInstance: vi.fn(),
}));

// Mock context providers
vi.mock("../settings/context", () => ({
  SettingsProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../platform/context", () => ({
  PlatformProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  usePlatform: () => ({
    process: { isAvailable: () => true },
    env: {
      theme: "theme-light",
      systemTheme: "light",
      locale: "en",
      devicePixelRatio: 1,
      onEnvironmentChange: vi.fn(() => vi.fn()),
    },
  }),
}));

let mockCurrentPage = "chat";
let mockProfiles: unknown[] = [];
let mockMessages: unknown[] = [];
const mockFetchClouds = vi.fn();
const mockStopMessage = vi.fn();
const mockSetManageToolData = vi.fn();
let mockManageToolData: unknown = undefined;

vi.mock("../store/context", () => ({
  StoresProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useStores: () => ({
    useMessageStore: () => ({
      messages: mockMessages,
      stopMessage: mockStopMessage,
    }),
    useProfilesStore: () => ({
      profiles: mockProfiles,
    }),
    useServersStore: () => ({
      manageToolData: mockManageToolData,
      setManageToolData: mockSetManageToolData,
    }),
    useRouter: () => ({
      currentPage: mockCurrentPage,
    }),
    useThemeStore: () => ({
      themeId: "theme-light",
      themeType: "light",
      scale: 1,
      initialized: true,
      setThemeId: vi.fn(),
      setScale: vi.fn(),
      initFromPlatform: vi.fn(),
    }),
    useCloudsStore: () => ({
      fetchClouds: mockFetchClouds,
      cloudProviders: [],
    }),
  }),
}));

vi.mock("../store/create-stores", () => ({
  createStores: vi.fn().mockReturnValue({}),
}));

vi.mock("../tools/context", () => ({
  ToolsProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useToolsContext: () => ({
    servers: { hostToolSource: { setGroups: vi.fn() } },
    hostToolGroups: [],
  }),
}));

vi.mock("../storage/context", () => ({
  StorageProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock hooks
vi.mock("../hooks/useMessages", () => ({
  default: () => ({
    onNew: vi.fn(),
    approveToolCall: vi.fn(),
    denyToolCall: vi.fn(),
  }),
}));

vi.mock("../hooks/useThreads", () => ({
  default: vi.fn(),
}));

vi.mock("../hooks/useServers", () => ({
  default: vi.fn(),
}));

vi.mock("../hooks/useProfiles", () => ({
  default: vi.fn(),
}));

// Mock @assistant-ui/react - capture calls to useExternalStoreRuntime
const mockUseExternalStoreRuntime = vi.fn().mockReturnValue({});
vi.mock("@assistant-ui/react", () => ({
  AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="runtime-provider">{children}</div>
  ),
  CompositeAttachmentAdapter: class {},
  SimpleImageAttachmentAdapter: class {},
  SimpleTextAttachmentAdapter: class {},
  useExternalStoreRuntime: (...args: unknown[]) =>
    mockUseExternalStoreRuntime(...args),
}));

// Mock page components
vi.mock("../components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock("../components/manage-tool-dialog", () => ({
  ManageToolDialog: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="manage-tool-dialog">
      <button data-testid="manage-tool-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

vi.mock("../pages/chat", () => ({
  default: () => <div data-testid="thread" />,
}));

vi.mock("../pages/empty-screen", () => ({
  default: () => <div data-testid="empty-screen" />,
}));

vi.mock("../pages/initial-setup", () => ({
  default: () => <div data-testid="initial-setup" />,
}));

vi.mock("../pages/settings", () => ({
  default: () => <div data-testid="settings" />,
}));

import { AIChatWidget } from "../AIChatWidget";

const mockStorage = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
} as unknown as Parameters<typeof AIChatWidget>[0]["storage"];

const mockSettings = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  remove: vi.fn(),
} as unknown as Parameters<typeof AIChatWidget>[0]["settings"];

const mockPlatform = {
  process: { isAvailable: () => true },
  environment: { getType: () => "web" },
} as unknown as Parameters<typeof AIChatWidget>[0]["platform"];

const defaultProps = {
  storage: mockStorage,
  settings: mockSettings,
  platform: mockPlatform,
  storeKeys: {
    threads: "threads",
    profiles: "profiles",
    prompts: "prompts",
    servers: "servers",
    clouds: "clouds",
  } as Parameters<typeof AIChatWidget>[0]["storeKeys"],
};

describe("AIChatWidget", () => {
  beforeEach(() => {
    mockInitI18n.mockResolvedValue(undefined);
    mockCurrentPage = "chat";
    mockProfiles = [];
    mockMessages = [];
    mockManageToolData = undefined;
  });

  it("renders without crashing", async () => {
    const { container } = render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(container.innerHTML).not.toBe("");
    });
  });

  it("renders layout after i18n init", async () => {
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
  });

  it("renders empty screen when no profiles and no messages", async () => {
    mockProfiles = [];
    mockMessages = [];
    mockCurrentPage = "chat";
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("empty-screen")).toBeInTheDocument();
    });
  });

  it("renders Thread (chat) page when profiles exist", async () => {
    mockProfiles = [{ id: "p1", name: "Test" }];
    mockCurrentPage = "chat";
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("thread")).toBeInTheDocument();
    });
  });

  it("renders settings page when currentPage is settings", async () => {
    mockCurrentPage = "settings";
    mockProfiles = [];
    mockMessages = [];
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("settings")).toBeInTheDocument();
    });
  });

  it("renders initial-setup page when currentPage is initial-setup", async () => {
    mockCurrentPage = "initial-setup";
    mockProfiles = [{ id: "p1", name: "Test" }];
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("initial-setup")).toBeInTheDocument();
    });
  });

  it("renders Thread page when messages exist but no profiles", async () => {
    mockProfiles = [];
    mockMessages = [{ id: "m1", role: "user", content: "hi" }];
    mockCurrentPage = "chat";
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("thread")).toBeInTheDocument();
    });
  });

  it("calls fetchClouds on mount", async () => {
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(mockFetchClouds).toHaveBeenCalled();
    });
  });

  it("renders with onMigrate callback", async () => {
    const onMigrate = vi.fn().mockResolvedValue(undefined);
    render(<AIChatWidget {...defaultProps} onMigrate={onMigrate} />);
    await vi.waitFor(() => {
      expect(onMigrate).toHaveBeenCalled();
    });
  });

  it("renders with hostToolGroups prop", async () => {
    const hostToolGroups = [
      {
        name: "test",
        tools: [],
      },
    ] as unknown as Parameters<typeof AIChatWidget>[0]["hostToolGroups"];
    render(<AIChatWidget {...defaultProps} hostToolGroups={hostToolGroups} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
  });

  it("shows ManageToolDialog when manageToolData is set", async () => {
    mockManageToolData = { toolName: "test" };
    mockProfiles = [{ id: "p1", name: "Test" }];
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("manage-tool-dialog")).toBeInTheDocument();
    });
  });

  it("closes ManageToolDialog when onClose is called", async () => {
    mockManageToolData = { toolName: "test" };
    mockProfiles = [{ id: "p1", name: "Test" }];
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("manage-tool-dialog")).toBeInTheDocument();
    });
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(screen.getByTestId("manage-tool-close"));
    await vi.waitFor(() => {
      expect(
        screen.queryByTestId("manage-tool-dialog")
      ).not.toBeInTheDocument();
    });
    expect(mockSetManageToolData).toHaveBeenCalledWith(undefined);
  });

  it("exercises onCancel callback from runtime config", async () => {
    mockProfiles = [{ id: "p1", name: "Test" }];
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(mockUseExternalStoreRuntime).toHaveBeenCalled();
    });
    const callArgs = mockUseExternalStoreRuntime.mock.calls[0][0] as {
      onCancel: () => Promise<void>;
      convertMessage: (m: unknown) => unknown;
    };
    // Exercise onCancel
    await callArgs.onCancel();
    expect(mockStopMessage).toHaveBeenCalled();
    // Exercise convertMessage
    const msg = { id: "1", role: "user", content: "hi" };
    expect(callArgs.convertMessage(msg)).toBe(msg);
  });

  it("handles migration failure gracefully", async () => {
    const onMigrate = vi.fn().mockRejectedValue(new Error("migration error"));
    mockProfiles = [];
    mockMessages = [];
    render(<AIChatWidget {...defaultProps} onMigrate={onMigrate} />);
    await vi.waitFor(() => {
      expect(onMigrate).toHaveBeenCalled();
    });
    // Widget should still render (isReady set to true on error)
    await vi.waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
  });
});
