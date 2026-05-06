// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockSaveConfig = vi.fn();
const mockGetConfig = vi.fn().mockReturnValue({ mcpServers: {} });
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
      };
      return typeof selector === "function" ? selector(state) : state;
    },
  }),
}));

vi.mock("../../../components/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({
    children,
    header,
    onClose,
  }: {
    children: React.ReactNode;
    header: string;
    onClose: () => void;
  }) => (
    <div data-testid="dialog-content" id="dialog-content">
      <h2>{header}</h2>
      <button data-testid="close-btn" onClick={onClose}>
        close
      </button>
      {children}
    </div>
  ),
  DialogOverlay: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-overlay" {...props}>
      {children}
    </div>
  ),
  DialogFooter: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-footer" {...props}>
      {children}
    </div>
  ),
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

vi.mock("../sub-components/ConfigDialog.css", () => ({}));

import ConfigDialog from "../sub-components/ConfigDialog";

describe("ConfigDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    editorUpdateListener = null;
    mockGetConfig.mockReturnValue({ mcpServers: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render when open is false", () => {
    render(<ConfigDialog open={false} onClose={mockOnClose} />);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog when open is true", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
  });

  it("renders header text", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);
    expect(screen.getByText("EditConfiguration")).toBeInTheDocument();
  });

  it("renders JSON configuration label and lang indicator", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);
    expect(screen.getByText("EnterYourJSONConfiguration")).toBeInTheDocument();
    expect(screen.getByText("json")).toBeInTheDocument();
  });

  it("renders save and cancel buttons", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onClose via dialog close button", () => {
    mockOnClose.mockClear();
    render(<ConfigDialog open={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId("close-btn"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("initializes editor with config data after timeout", () => {
    mockGetConfig.mockReturnValue({
      mcpServers: { test: { url: "http://test" } },
    });
    mockEditorDestroy.mockClear();
    const { unmount } = render(
      <ConfigDialog open={true} onClose={mockOnClose} />
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });

    // Editor was created - verify by unmounting and checking destroy
    unmount();
    expect(mockEditorDestroy).toHaveBeenCalled();
  });

  it("save button calls saveConfig and onClose with valid JSON", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    // The initial config { mcpServers: {} } is valid, so save should be enabled
    fireEvent.click(screen.getByTestId("btn-Save"));

    expect(mockSaveConfig).toHaveBeenCalledWith({ mcpServers: {} });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("save button is disabled when JSON is invalid", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);

    act(() => {
      vi.advanceTimersByTime(50);
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

  it("shows error message for invalid JSON format", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    if (editorUpdateListener) {
      act(() => {
        editorUpdateListener!({
          docChanged: true,
          state: { doc: { toString: () => "{invalid" } },
        });
      });
    }

    expect(screen.getByText(/Invalid JSON format/)).toBeInTheDocument();
  });

  it("shows error when valid JSON but no mcpServers key", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);

    act(() => {
      vi.advanceTimersByTime(50);
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

  it("validates and accepts valid JSON with mcpServers", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);

    act(() => {
      vi.advanceTimersByTime(50);
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

  it("handles Enter key on dialog-content to submit", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    // Simulate focusing the dialog content
    const dialogContent = screen.getByTestId("dialog-content");
    Object.defineProperty(document, "activeElement", {
      value: dialogContent,
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

  it("does not submit on Enter when save is invalid", () => {
    render(<ConfigDialog open={true} onClose={mockOnClose} />);

    act(() => {
      vi.advanceTimersByTime(50);
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

    const dialogContent = screen.getByTestId("dialog-content");
    Object.defineProperty(document, "activeElement", {
      value: dialogContent,
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

  it("destroys editor view on unmount", () => {
    const { unmount } = render(
      <ConfigDialog open={true} onClose={mockOnClose} />
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });

    unmount();

    expect(mockEditorDestroy).toHaveBeenCalled();
  });

  it("creates editor after initialization timeout", () => {
    mockEditorDestroy.mockClear();
    const { unmount } = render(
      <ConfigDialog open={true} onClose={mockOnClose} />
    );

    // First timeout (50ms) triggers initializeEditor
    act(() => {
      vi.advanceTimersByTime(50);
    });

    // Editor was created - verify by unmounting and checking destroy is called
    unmount();
    expect(mockEditorDestroy).toHaveBeenCalled();
  });
});

describe("ConfigDialog - platform local server validation", () => {
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
    const platformMock = await import("../../../providers/PlatformProvider/context");
    vi.spyOn(platformMock, "usePlatform").mockReturnValue({
      process: { isAvailable: () => false },
    } as ReturnType<typeof platformMock.usePlatform>);

    render(<ConfigDialog open={true} onClose={mockOnClose} />);

    act(() => {
      vi.advanceTimersByTime(50);
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
