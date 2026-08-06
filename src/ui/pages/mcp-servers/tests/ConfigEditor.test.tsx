// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockSaveConfig = vi.fn();
// getConfig is async and resolves to the mcpServers map (not the wrapping
// `{ mcpServers }` object — that wrapping happens inside the editor).
const mockGetConfig = vi.fn<() => Promise<Record<string, unknown>>>();
const mockSetMcpConfigDirty = vi.fn();
const mockOnClose = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../providers/PlatformProvider/context", () => ({
  usePlatform: () => ({
    process: { isAvailable: () => true },
  }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useServersStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        saveConfig: mockSaveConfig,
        getConfig: mockGetConfig,
        setMcpConfigDirty: mockSetMcpConfigDirty,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
  }),
}));

vi.mock("../../../components/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={`btn-${children}`}
    >
      {children}
    </button>
  ),
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: ({
    iconName,
    onClick,
  }: {
    iconName: string;
    onClick?: () => void;
  }) => (
    <button data-testid={`icon-btn-${iconName}`} onClick={onClick}>
      {iconName}
    </button>
  ),
}));

// Store the update listener callback so we can simulate editor changes
let editorUpdateListener:
  | ((update: {
      docChanged: boolean;
      state: { doc: { toString: () => string } };
    }) => void)
  | null = null;
const mockEditorDestroy = vi.fn();

vi.mock("@codemirror/lang-json", () => ({
  json: vi.fn(),
}));

vi.mock("@codemirror/state", () => ({
  EditorState: {
    create: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("codemirror", () => {
  class MockEditorView {
    static updateListener = {
      of: (cb: unknown) => {
        editorUpdateListener = cb as typeof editorUpdateListener;
        return {};
      },
    };
    static theme = vi.fn().mockReturnValue({});
    destroy = mockEditorDestroy;
  }
  return {
    basicSetup: [],
    EditorView: MockEditorView,
  };
});

vi.mock("../sub-components/ConfigEditor.css", () => ({}));

import ConfigEditor from "../sub-components/ConfigEditor";

describe("ConfigEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    editorUpdateListener = null;
    mockGetConfig.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render when open is false", () => {
    render(<ConfigEditor open={false} onClose={mockOnClose} />);
    expect(screen.queryByTestId("config-editor")).not.toBeInTheDocument();
  });

  it("renders inline panel when open is true", () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);
    expect(screen.getByTestId("config-editor")).toBeInTheDocument();
  });

  it("renders header text", () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);
    expect(screen.getByText("EditConfiguration")).toBeInTheDocument();
  });

  it("renders JSON configuration label and lang indicator", () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);
    expect(screen.getByText("EnterYourJSONConfiguration")).toBeInTheDocument();
    expect(screen.getByText("json")).toBeInTheDocument();
  });

  it("renders save and cancel buttons", () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("initializes editor with config data after timeout", async () => {
    mockGetConfig.mockResolvedValue({ test: { url: "http://test" } });
    mockEditorDestroy.mockClear();
    const { unmount } = render(
      <ConfigEditor open={true} onClose={mockOnClose} />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Editor was created - verify by unmounting and checking destroy
    unmount();
    expect(mockEditorDestroy).toHaveBeenCalled();
  });

  it("save button calls saveConfig and onClose with valid JSON", async () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // The initial config { mcpServers: {} } is valid, so save should be enabled
    fireEvent.click(screen.getByTestId("btn-Save"));

    expect(mockSaveConfig).toHaveBeenCalledWith({ mcpServers: {} });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("save button is disabled when JSON is invalid", async () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Simulate invalid JSON through update listener
    if (editorUpdateListener) {
      act(() => {
        editorUpdateListener!({
          docChanged: true,
          state: { doc: { toString: () => "not valid json" } },
        });
      });
    }

    const saveBtn = screen.getByTestId("btn-Save");
    expect(saveBtn).toBeDisabled();
  });

  it("shows error message for invalid JSON format", async () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    if (editorUpdateListener) {
      act(() => {
        editorUpdateListener!({
          docChanged: true,
          state: { doc: { toString: () => "{invalid" } },
        });
      });
    }

    expect(screen.getByText(/InvalidJsonFormat/)).toBeInTheDocument();
  });

  it("shows error when valid JSON but no mcpServers key", async () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    if (editorUpdateListener) {
      act(() => {
        editorUpdateListener!({
          docChanged: true,
          state: { doc: { toString: () => '{"other": true}' } },
        });
      });
    }

    expect(screen.getByText("ConfigurationError")).toBeInTheDocument();
  });

  it("validates and accepts valid JSON with mcpServers", async () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    if (editorUpdateListener) {
      act(() => {
        editorUpdateListener!({
          docChanged: true,
          state: {
            doc: {
              toString: () =>
                '{"mcpServers": {"test": {"url": "http://test"}}}',
            },
          },
        });
      });
    }

    const saveBtn = screen.getByTestId("btn-Save");
    expect(saveBtn).not.toBeDisabled();
  });

  it("flags the config dirty when the document diverges from the loaded value", async () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Initial load resets the dirty flag.
    expect(mockSetMcpConfigDirty).toHaveBeenLastCalledWith(false);

    if (editorUpdateListener) {
      act(() => {
        editorUpdateListener!({
          docChanged: true,
          state: {
            doc: {
              toString: () =>
                '{"mcpServers": {"x": {"url": "http://x"}}}',
            },
          },
        });
      });
    }

    expect(mockSetMcpConfigDirty).toHaveBeenLastCalledWith(true);
  });

  it("clears the dirty flag when the editor is closed", () => {
    const { rerender } = render(
      <ConfigEditor open={true} onClose={mockOnClose} />
    );
    mockSetMcpConfigDirty.mockClear();
    rerender(<ConfigEditor open={false} onClose={mockOnClose} />);
    expect(mockSetMcpConfigDirty).toHaveBeenCalledWith(false);
  });

  it("handles Enter key on the panel to submit", async () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Simulate focusing the inline editor panel
    const panel = screen.getByTestId("config-editor");
    Object.defineProperty(document, "activeElement", {
      value: panel,
      configurable: true,
    });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });

    expect(mockSaveConfig).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("does not submit on Enter when save is invalid", async () => {
    render(<ConfigEditor open={true} onClose={mockOnClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Make JSON invalid
    if (editorUpdateListener) {
      act(() => {
        editorUpdateListener!({
          docChanged: true,
          state: { doc: { toString: () => "bad json" } },
        });
      });
    }

    const panel = screen.getByTestId("config-editor");
    Object.defineProperty(document, "activeElement", {
      value: panel,
      configurable: true,
    });

    mockSaveConfig.mockClear();
    mockOnClose.mockClear();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });

    expect(mockSaveConfig).not.toHaveBeenCalled();
  });

  it("destroys editor view on unmount", async () => {
    const { unmount } = render(
      <ConfigEditor open={true} onClose={mockOnClose} />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    unmount();

    expect(mockEditorDestroy).toHaveBeenCalled();
  });

  it("creates editor after initialization timeout", async () => {
    mockEditorDestroy.mockClear();
    const { unmount } = render(
      <ConfigEditor open={true} onClose={mockOnClose} />
    );

    // First timeout (50ms) triggers initializeEditor
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Editor was created - verify by unmounting and checking destroy is called
    unmount();
    expect(mockEditorDestroy).toHaveBeenCalled();
  });
});

describe("ConfigEditor - platform local server validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    editorUpdateListener = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows error for local servers when platform process is not available", async () => {
    // Re-mock platform to return process.isAvailable = false
    const platformMock =
      await import("../../../providers/PlatformProvider/context");
    vi.spyOn(platformMock, "usePlatform").mockReturnValue({
      process: { isAvailable: () => false },
    } as ReturnType<typeof platformMock.usePlatform>);

    render(<ConfigEditor open={true} onClose={mockOnClose} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    if (editorUpdateListener) {
      act(() => {
        editorUpdateListener!({
          docChanged: true,
          state: {
            doc: {
              toString: () =>
                '{"mcpServers": {"local": {"command": "node", "args": ["server.js"]}}}',
            },
          },
        });
      });
    }

    expect(
      screen.getByText("LocalServersNotSupportedInWebEditor")
    ).toBeInTheDocument();
  });
});
