// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — keep paths aligned with the real src layout under src/{ui,core,shared}
// ---------------------------------------------------------------------------

const mockInitI18n = vi.fn().mockResolvedValue(undefined);
vi.mock("../ui/providers/LocalesProvider", () => ({
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

vi.mock("../shared/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Servers class - needs hostToolSource.setGroups
vi.mock("../ui/tools/servers", () => ({
  default: class MockServers {
    hostToolSource = { setGroups: vi.fn() };
  },
}));

vi.mock("../ui/providers/EventsProvider", () => ({
  ChatEventBus: class MockEventBus {
    on = vi.fn();
    off = vi.fn();
    emit = vi.fn();
  },
  CallbacksManager: class MockCallbacksManager {
    emit = vi.fn();
    setCallbacks = vi.fn();
    getCallbacks = vi.fn().mockReturnValue({});
  },
  EventsProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../core/middleware", () => ({
  MiddlewareRunner: class MockMiddleware {},
}));

vi.mock("../core/services", () => ({
  AIEngine: class {},
  AssignmentsEngine: class {},
  AttachmentsEngine: class {},
  PreferencesEngine: class {},
  ProfilesEngine: class {},
  PromptsEngine: class {},
  ThreadsEngine: class {},
  ToolsEngine: class {},
  WebSearchEngine: class {},
}));

let mockCurrentPage = "chat";
let mockProfiles: unknown[] = [];
let mockMessages: unknown[] = [];
const mockFetchClouds = vi.fn();
const mockSetManageToolData = vi.fn();
let mockManageToolData: unknown = undefined;

vi.mock("../ui/store/context", () => ({
  StoresProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useStores: () => ({
    useMessageStore: () => ({ messages: mockMessages, stopMessage: vi.fn() }),
    useProfilesStore: () => ({ profiles: mockProfiles }),
    useServersStore: () => ({
      manageToolData: mockManageToolData,
      setManageToolData: mockSetManageToolData,
      tools: {},
    }),
    useRouter: () => ({ currentPage: mockCurrentPage }),
    useThemeStore: () => ({
      themeId: "theme-light",
      themeType: "light",
      scale: 1,
      initialized: true,
      setThemeId: vi.fn(),
      setScale: vi.fn(),
      initFromPlatform: vi.fn(),
    }),
    useCloudsStore: () => ({ fetchClouds: mockFetchClouds, cloudProviders: [] }),
    selectCurrentChatProfile: vi.fn(),
  }),
}));

vi.mock("../ui/store/create-stores", () => ({
  createStores: vi.fn().mockReturnValue({}),
}));

vi.mock("../ui/tools/context", () => ({
  ToolsProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useToolsContext: () => ({
    servers: { hostToolSource: { setGroups: vi.fn() } },
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    hostToolGroups: [],
  }),
}));

vi.mock("../ui/providers/PlatformProvider/context", () => ({
  PlatformProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  usePlatform: () => ({
    process: { isAvailable: () => true },
    file: null,
    hostTools: null,
    clouds: null,
    env: {
      theme: "theme-light",
      systemTheme: "light",
      locale: "en",
      devicePixelRatio: 1,
      onEnvironmentChange: vi.fn(() => vi.fn()),
    },
  }),
}));

vi.mock("../ui/providers/ApiProvider", () => ({
  ApiProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  createServerAPI: vi.fn().mockReturnValue({}),
  DEFAULT_SERVER_API_ROUTES: {},
}));

vi.mock("../ui/providers/ComponentsProvider", () => ({
  ComponentsProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../ui/providers/ImagesProvider", () => ({
  ImagesProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../ui/providers/ThemeProvider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../widget-config", () => ({
  WidgetConfigProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Hooks
vi.mock("../ui/hooks/useMessages", () => ({
  default: () => ({
    onNew: vi.fn(),
    approveToolCall: vi.fn(),
    denyToolCall: vi.fn(),
  }),
}));
vi.mock("../ui/hooks/useThreads", () => ({ default: vi.fn() }));
vi.mock("../ui/hooks/useServers", () => ({ default: vi.fn() }));
vi.mock("../ui/hooks/useProfiles", () => ({ default: vi.fn() }));

vi.mock("../ui/providers/ImperativeProvider", () => ({
  createWidgetRef: vi.fn().mockReturnValue({}),
}));

// Page / layout components
vi.mock("../ui/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock("../ui/components/manage-tool-dialog", () => ({
  ManageToolDialog: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="manage-tool-dialog">
      <button data-testid="manage-tool-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

vi.mock("../ui/pages/chat", () => ({
  default: () => <div data-testid="thread" />,
}));

vi.mock("../ui/pages/settings", () => ({
  default: () => <div data-testid="settings" />,
}));

import { AIChatWidget } from "../AIChatWidget";

const mockStorage = {} as Parameters<typeof AIChatWidget>[0]["storage"];
const mockSettings = {} as Parameters<typeof AIChatWidget>[0]["settings"];
const mockPlatform = {
  file: null,
  process: { isAvailable: () => true },
  hostTools: null,
  clouds: null,
  env: {
    theme: "theme-light",
    systemTheme: "light",
    locale: "en",
    devicePixelRatio: 1,
  },
} as Parameters<typeof AIChatWidget>[0]["platform"];

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
  } as unknown as Parameters<typeof AIChatWidget>[0]["storeKeys"],
};

describe("AIChatWidget", () => {
  beforeEach(() => {
    mockInitI18n.mockResolvedValue(undefined);
    mockCurrentPage = "chat";
    mockProfiles = [];
    mockMessages = [];
    mockManageToolData = undefined;
    mockFetchClouds.mockClear();
    mockSetManageToolData.mockClear();
  });

  it("renders without crashing", async () => {
    const { container } = render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(container.innerHTML).not.toBe("");
    });
  });

  it("renders layout", async () => {
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
  });

  it("renders chat page (Thread) by default", async () => {
    mockCurrentPage = "chat";
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("thread")).toBeInTheDocument();
    });
  });

  it("renders settings page when currentPage is settings", async () => {
    mockCurrentPage = "settings";
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("settings")).toBeInTheDocument();
    });
  });

  it("calls fetchClouds on mount", async () => {
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(mockFetchClouds).toHaveBeenCalled();
    });
  });

  it("calls onMigrate callback", async () => {
    const onMigrate = vi.fn().mockResolvedValue(undefined);
    render(<AIChatWidget {...defaultProps} onMigrate={onMigrate} />);
    await vi.waitFor(() => {
      expect(onMigrate).toHaveBeenCalled();
    });
  });

  it("renders with hostToolGroups prop", async () => {
    const hostToolGroups = [
      { id: "test", name: "test", tools: [] },
    ] as unknown as Parameters<typeof AIChatWidget>[0]["hostToolGroups"];
    render(<AIChatWidget {...defaultProps} hostToolGroups={hostToolGroups} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
  });

  it("shows ManageToolDialog when manageToolData is set", async () => {
    mockManageToolData = { toolName: "test" };
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("manage-tool-dialog")).toBeInTheDocument();
    });
  });

  it("closes ManageToolDialog when onClose is fired", async () => {
    mockManageToolData = { toolName: "test" };
    render(<AIChatWidget {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("manage-tool-dialog")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("manage-tool-close"));
    expect(mockSetManageToolData).toHaveBeenCalledWith(undefined);
  });

  it("handles migration failure gracefully", async () => {
    const onMigrate = vi.fn().mockRejectedValue(new Error("migration error"));
    render(<AIChatWidget {...defaultProps} onMigrate={onMigrate} />);
    await vi.waitFor(() => {
      expect(onMigrate).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
  });
});
