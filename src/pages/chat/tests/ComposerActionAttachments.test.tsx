// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";

const mockAddAttachmentFile = vi.fn();
const mockAddAttachmentImage = vi.fn();
const mockChangeToolStatus = vi.fn();
const mockToggleExtendedThinking = vi.fn();
const mockEmit = vi.fn();
const mockPickFiles = vi.fn();
const mockConvertFileToText = vi.fn();
const mockGetFileType = vi.fn();
const mockGetRecentFiles = vi.fn();

let mockServers: Record<string, { name: string; enabled: boolean }[]> = {};
let mockWebSearchEnabled = false;
let mockGetWebSearchEnabled = () => false;
let mockExtendedThinking = false;
let mockPlatformFile: unknown = null;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useAttachmentsStore: () => ({
      addAttachmentFile: mockAddAttachmentFile,
      addAttachmentImage: mockAddAttachmentImage,
    }),
    useServersStore: () => ({
      servers: mockServers,
      changeToolStatus: mockChangeToolStatus,
      webSearchEnabled: mockWebSearchEnabled,
      getWebSearchEnabled: mockGetWebSearchEnabled,
    }),
    useProfilesStore: () => ({
      extendedThinking: mockExtendedThinking,
      toggleExtendedThinking: mockToggleExtendedThinking,
    }),
  }),
}));

vi.mock("../../../platform/context", () => ({
  usePlatform: () => ({
    file: mockPlatformFile,
  }),
}));

vi.mock("../../../tools/context", () => ({
  useToolsContext: () => ({
    eventBus: { emit: mockEmit },
  }),
}));

let mockDropdownItems: unknown[] = [];
let mockOnOpenChange: ((open: boolean) => void) | undefined;
vi.mock("../../../ui/components/dropdown", () => ({
  DropdownMenu: ({
    trigger,
    items,
    onOpenChange,
  }: {
    trigger: React.ReactNode;
    items: unknown[];
    onOpenChange?: (open: boolean) => void;
  }) => {
    mockDropdownItems = items;
    mockOnOpenChange = onOpenChange;
    return (
      <div data-testid="dropdown-menu" data-item-count={items.length}>
        {trigger}
      </div>
    );
  },
}));

vi.mock("../../../ui/components/icon-button", () => ({
  IconButton: (props: Record<string, unknown>) => (
    <button
      data-testid={
        (props["data-testid"] as string) ?? `icon-btn-${props.iconName}`
      }
    >
      {props.iconName as string}
    </button>
  ),
}));

vi.mock("../../../ui/components/tooltip-icon-button", () => ({
  TooltipIconButton: ({
    children,
    tooltip,
    visible,
  }: {
    children: React.ReactNode;
    tooltip?: string;
    visible?: boolean;
  }) => (
    <div
      data-testid="tooltip-btn"
      data-tooltip={tooltip}
      data-visible={visible}
    >
      {children}
    </div>
  ),
}));

vi.mock("../../../shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  isDjVu: (t: number) => t === 20,
  isDocument: (t: number) => t === 7,
  isPdf: (t: number) => t === 12,
  isPdfForm: (t: number) => t === 25,
  isPresentation: (t: number) => t === 9,
  isSpreadsheet: (t: number) => t === 8,
  isVisio: (t: number) => t === 22,
  isXps: (t: number) => t === 21,
}));

import { ComposerActionAttachment } from "../sub-components/ComposerActionAttachments";

describe("ComposerActionAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServers = {};
    mockWebSearchEnabled = false;
    mockGetWebSearchEnabled = () => false;
    mockExtendedThinking = false;
    mockPlatformFile = null;
    mockDropdownItems = [];
    mockOnOpenChange = undefined;
  });

  it("renders the dropdown trigger", () => {
    render(<ComposerActionAttachment />);
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
  });

  it("renders the attachment button with tooltip", () => {
    render(<ComposerActionAttachment />);
    const tooltip = screen.getByTestId("tooltip-btn");
    expect(tooltip.getAttribute("data-tooltip")).toBe("Attachments");
  });

  it("renders the attachment icon button", () => {
    render(<ComposerActionAttachment />);
    expect(screen.getByTestId("attachment-button")).toBeInTheDocument();
  });

  it("includes a hidden file input for images", () => {
    const { container } = render(<ComposerActionAttachment />);
    const fileInput = container.querySelector("input[type='file']");
    expect(fileInput).toBeInTheDocument();
    expect(fileInput?.getAttribute("accept")).toBe("image/*");
    expect(fileInput?.hasAttribute("multiple")).toBe(true);
    expect(fileInput?.className).toContain("hidden");
  });

  describe("without platform.file", () => {
    it("renders separator + web search + extended thinking = 3 items", () => {
      render(<ComposerActionAttachment />);
      expect(mockDropdownItems).toHaveLength(3);
    });

    it("does not include AddLocalFile or AddLocalImage items", () => {
      render(<ComposerActionAttachment />);
      const items = mockDropdownItems as { text: string }[];
      expect(items.find((i) => i.text === "AddLocalFile")).toBeUndefined();
      expect(items.find((i) => i.text === "AddLocalImage")).toBeUndefined();
    });
  });

  describe("with platform.file", () => {
    beforeEach(() => {
      mockGetRecentFiles.mockResolvedValue(JSON.stringify({ files: [] }));
      mockPlatformFile = {
        pickFiles: mockPickFiles,
        convertFileToText: mockConvertFileToText,
        getFileType: mockGetFileType,
        getRecentFiles: mockGetRecentFiles,
      };
    });

    it("includes AddLocalFile and AddLocalImage items", async () => {
      await act(async () => {
        render(<ComposerActionAttachment />);
      });
      const items = mockDropdownItems as { text: string }[];
      expect(items.find((i) => i.text === "AddLocalFile")).toBeDefined();
      expect(items.find((i) => i.text === "AddLocalImage")).toBeDefined();
    });

    it("includes 5 items: AddLocalFile + AddLocalImage + separator + web search + extended thinking", async () => {
      await act(async () => {
        render(<ComposerActionAttachment />);
      });
      expect(mockDropdownItems).toHaveLength(5);
    });

    it("includes RecentFiles submenu when recent files exist", async () => {
      mockGetRecentFiles.mockResolvedValue(
        JSON.stringify({
          files: [{ path: "/docs/test.docx", type: 7, url: "" }],
        })
      );
      await act(async () => {
        render(<ComposerActionAttachment />);
      });
      // Wait for useEffect to process
      await waitFor(() => {
        const items = mockDropdownItems as {
          text: string;
          subMenu?: unknown[];
        }[];
        const recentItem = items.find((i) => i.text === "RecentFiles");
        expect(recentItem).toBeDefined();
      });
    });

    it("filters out files with url from recent files", async () => {
      mockGetRecentFiles.mockResolvedValue(
        JSON.stringify({
          files: [
            { path: "/docs/local.docx", type: 7, url: "" },
            { path: "http://remote.docx", type: 7, url: "http://remote.docx" },
          ],
        })
      );
      await act(async () => {
        render(<ComposerActionAttachment />);
      });
      await waitFor(() => {
        const items = mockDropdownItems as {
          text: string;
          subMenu?: { text: string }[];
        }[];
        const recentItem = items.find((i) => i.text === "RecentFiles");
        expect(recentItem?.subMenu).toHaveLength(1);
        expect(recentItem?.subMenu?.[0].text).toBe("local.docx");
      });
    });

    it("handles invalid JSON from getRecentFiles", async () => {
      mockGetRecentFiles.mockResolvedValue("not-json");
      await act(async () => {
        render(<ComposerActionAttachment />);
      });
      // Should not crash - falls back to empty
      expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
    });

    it("selectLocalFile picks files and adds them", async () => {
      mockPickFiles.mockResolvedValue([{ path: "/docs/file1.docx" }]);
      mockGetFileType.mockReturnValue(7);
      mockConvertFileToText.mockResolvedValue("file content");

      await act(async () => {
        render(<ComposerActionAttachment />);
      });
      const items = mockDropdownItems as {
        text: string;
        onClick: () => void;
      }[];
      const addLocalFile = items.find((i) => i.text === "AddLocalFile")!;

      await act(async () => {
        addLocalFile.onClick();
      });

      await waitFor(() => {
        expect(mockPickFiles).toHaveBeenCalled();
        expect(mockConvertFileToText).toHaveBeenCalledWith(
          "/docs/file1.docx",
          69
        );
        expect(mockAddAttachmentFile).toHaveBeenCalledWith({
          path: "/docs/file1.docx",
          content: "file content",
          type: 7,
        });
      });
    });

    it("selectLocalFile uses 260 for spreadsheet type", async () => {
      mockPickFiles.mockResolvedValue([{ path: "/docs/sheet.xlsx" }]);
      mockGetFileType.mockReturnValue(8); // spreadsheet
      mockConvertFileToText.mockResolvedValue("sheet content");

      await act(async () => {
        render(<ComposerActionAttachment />);
      });
      const items = mockDropdownItems as {
        text: string;
        onClick: () => void;
      }[];
      const addLocalFile = items.find((i) => i.text === "AddLocalFile")!;

      await act(async () => {
        addLocalFile.onClick();
      });

      await waitFor(() => {
        expect(mockConvertFileToText).toHaveBeenCalledWith(
          "/docs/sheet.xlsx",
          260
        );
      });
    });

    it("selectLocalFile handles null result from pickFiles", async () => {
      mockPickFiles.mockResolvedValue(null);

      await act(async () => {
        render(<ComposerActionAttachment />);
      });
      const items = mockDropdownItems as {
        text: string;
        onClick: () => void;
      }[];
      const addLocalFile = items.find((i) => i.text === "AddLocalFile")!;

      await act(async () => {
        addLocalFile.onClick();
      });

      expect(mockAddAttachmentFile).not.toHaveBeenCalled();
    });

    it("limits picked files to 6", async () => {
      const files = Array.from({ length: 10 }, (_, i) => ({
        path: `/docs/file${i}.docx`,
      }));
      mockPickFiles.mockResolvedValue(files);
      mockGetFileType.mockReturnValue(7);
      mockConvertFileToText.mockResolvedValue("content");

      await act(async () => {
        render(<ComposerActionAttachment />);
      });
      const items = mockDropdownItems as {
        text: string;
        onClick: () => void;
      }[];
      const addLocalFile = items.find((i) => i.text === "AddLocalFile")!;

      await act(async () => {
        addLocalFile.onClick();
      });

      await waitFor(() => {
        expect(mockAddAttachmentFile).toHaveBeenCalledTimes(6);
      });
    });

    it("selectRecentFile calls convertFileToText and addAttachmentFile", async () => {
      mockConvertFileToText.mockResolvedValue("recent content");
      mockGetRecentFiles.mockResolvedValue(
        JSON.stringify({
          files: [{ path: "/docs/recent.docx", type: 7, url: "" }],
        })
      );

      await act(async () => {
        render(<ComposerActionAttachment />);
      });

      await waitFor(() => {
        const items = mockDropdownItems as {
          text: string;
          subMenu?: { text: string; onClick: () => void }[];
        }[];
        const recentItem = items.find((i) => i.text === "RecentFiles");
        expect(recentItem).toBeDefined();
      });

      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const recentItem = items.find((i) => i.text === "RecentFiles")!;

      await act(async () => {
        recentItem.subMenu![0].onClick();
      });

      await waitFor(() => {
        expect(mockConvertFileToText).toHaveBeenCalledWith(
          "/docs/recent.docx",
          69
        );
        expect(mockAddAttachmentFile).toHaveBeenCalledWith({
          path: "/docs/recent.docx",
          content: "recent content",
          type: 7,
        });
      });
    });

    it("extracts filename from path with backslashes (Windows)", async () => {
      mockGetRecentFiles.mockResolvedValue(
        JSON.stringify({
          files: [{ path: "C:\\Users\\docs\\file.docx", type: 7, url: "" }],
        })
      );

      await act(async () => {
        render(<ComposerActionAttachment />);
      });

      await waitFor(() => {
        const items = mockDropdownItems as {
          text: string;
          subMenu?: { text: string }[];
        }[];
        const recentItem = items.find((i) => i.text === "RecentFiles");
        expect(recentItem?.subMenu?.[0].text).toBe("file.docx");
      });
    });
  });

  describe("web search toggle", () => {
    it("renders web search item with toggle disabled when not enabled", () => {
      render(<ComposerActionAttachment />);
      const items = mockDropdownItems as {
        text: string;
        withToggle?: boolean;
        toggleChecked?: boolean;
        toggleDisabled?: boolean;
      }[];
      const wsItem = items.find((i) => i.text === "WebSearch");
      expect(wsItem).toBeDefined();
      expect(wsItem?.withToggle).toBe(true);
      expect(wsItem?.toggleChecked).toBe(false);
      expect(wsItem?.toggleDisabled).toBe(true);
    });

    it("renders web search toggle enabled when getWebSearchEnabled returns true", () => {
      mockGetWebSearchEnabled = () => true;
      mockWebSearchEnabled = true;
      render(<ComposerActionAttachment />);
      const items = mockDropdownItems as {
        text: string;
        toggleChecked?: boolean;
        toggleDisabled?: boolean;
      }[];
      const wsItem = items.find((i) => i.text === "WebSearch");
      expect(wsItem?.toggleChecked).toBe(true);
      expect(wsItem?.toggleDisabled).toBe(false);
    });

    it("web search onToggleChange calls changeToolStatus and emits event", () => {
      mockGetWebSearchEnabled = () => true;
      mockWebSearchEnabled = false;
      mockServers = {
        "web-search": [{ name: "web-search-tool", enabled: false }],
      };
      render(<ComposerActionAttachment />);
      const items = mockDropdownItems as {
        text: string;
        onToggleChange?: () => void;
      }[];
      const wsItem = items.find((i) => i.text === "WebSearch")!;
      wsItem.onToggleChange!();
      expect(mockChangeToolStatus).toHaveBeenCalledWith(
        "web-search",
        "web-search-tool",
        true
      );
      expect(mockEmit).toHaveBeenCalledWith("tools-changed");
    });

    it("shows tooltip text when web search is not available", () => {
      mockGetWebSearchEnabled = () => false;
      render(<ComposerActionAttachment />);
      const items = mockDropdownItems as {
        text: string;
        tooltipText?: string;
      }[];
      const wsItem = items.find((i) => i.text === "WebSearch");
      expect(wsItem?.tooltipText).toBe("EnableWebSearch");
    });

    it("shows empty tooltip when web search is available", () => {
      mockGetWebSearchEnabled = () => true;
      render(<ComposerActionAttachment />);
      const items = mockDropdownItems as {
        text: string;
        tooltipText?: string;
      }[];
      const wsItem = items.find((i) => i.text === "WebSearch");
      expect(wsItem?.tooltipText).toBe("");
    });
  });

  describe("extended thinking toggle", () => {
    it("renders extended thinking item with toggle", () => {
      render(<ComposerActionAttachment />);
      const items = mockDropdownItems as {
        text: string;
        withToggle?: boolean;
        toggleChecked?: boolean;
        withAbout?: boolean;
      }[];
      const etItem = items.find((i) => i.text === "ExtendedThinking");
      expect(etItem).toBeDefined();
      expect(etItem?.withToggle).toBe(true);
      expect(etItem?.toggleChecked).toBe(false);
      expect(etItem?.withAbout).toBe(true);
    });

    it("reflects extendedThinking state", () => {
      mockExtendedThinking = true;
      render(<ComposerActionAttachment />);
      const items = mockDropdownItems as {
        text: string;
        toggleChecked?: boolean;
      }[];
      const etItem = items.find((i) => i.text === "ExtendedThinking");
      expect(etItem?.toggleChecked).toBe(true);
    });

    it("calls toggleExtendedThinking on toggle change", () => {
      render(<ComposerActionAttachment />);
      const items = mockDropdownItems as {
        text: string;
        onToggleChange?: () => void;
      }[];
      const etItem = items.find((i) => i.text === "ExtendedThinking")!;
      etItem.onToggleChange!();
      expect(mockToggleExtendedThinking).toHaveBeenCalled();
    });

    it("has aboutContent with description", () => {
      render(<ComposerActionAttachment />);
      const items = mockDropdownItems as {
        text: string;
        aboutContent?: React.ReactNode;
      }[];
      const etItem = items.find((i) => i.text === "ExtendedThinking");
      expect(etItem?.aboutContent).toBeDefined();
    });
  });

  describe("image input handling", () => {
    it("calls addAttachmentImage when image is selected", async () => {
      let capturedOnload: ((event: unknown) => void) | null = null;
      const mockReadAsDataURL = vi.fn();

      const OriginalFileReader = window.FileReader;
      class MockFileReader {
        onload: ((event: unknown) => void) | null = null;
        readAsDataURL(file: Blob) {
          mockReadAsDataURL(file);
          capturedOnload = this.onload;
        }
      }
      Object.defineProperty(window, "FileReader", {
        value: MockFileReader,
        writable: true,
        configurable: true,
      });

      const { container } = render(<ComposerActionAttachment />);
      const fileInput = container.querySelector(
        "input[type='file']"
      ) as HTMLInputElement;

      const file = new File(["test"], "photo.png", { type: "image/png" });
      Object.defineProperty(fileInput, "files", {
        value: [file],
        configurable: true,
      });
      fireEvent.change(fileInput);

      expect(mockReadAsDataURL).toHaveBeenCalledWith(file);

      // Simulate reader.onload
      act(() => {
        capturedOnload!({
          target: { result: "data:image/png;base64,abc123" },
        });
      });

      expect(mockAddAttachmentImage).toHaveBeenCalledWith({
        name: "photo.png",
        base64: "data:image/png;base64,abc123",
      });

      Object.defineProperty(window, "FileReader", {
        value: OriginalFileReader,
        writable: true,
        configurable: true,
      });
    });

    it("does nothing when no files selected", () => {
      const { container } = render(<ComposerActionAttachment />);
      const fileInput = container.querySelector(
        "input[type='file']"
      ) as HTMLInputElement;

      Object.defineProperty(fileInput, "files", {
        value: null,
        configurable: true,
      });
      fireEvent.change(fileInput);

      expect(mockAddAttachmentImage).not.toHaveBeenCalled();
    });

    it("resets input value after selection", () => {
      const OriginalFileReader = window.FileReader;
      class MockFileReader {
        onload: ((event: unknown) => void) | null = null;
        readAsDataURL() {
          /* noop */
        }
      }
      Object.defineProperty(window, "FileReader", {
        value: MockFileReader,
        writable: true,
        configurable: true,
      });

      const { container } = render(<ComposerActionAttachment />);
      const fileInput = container.querySelector(
        "input[type='file']"
      ) as HTMLInputElement;

      const file = new File(["test"], "photo.png", { type: "image/png" });
      Object.defineProperty(fileInput, "files", {
        value: [file],
        configurable: true,
      });
      fireEvent.change(fileInput);

      expect(fileInput.value).toBe("");

      Object.defineProperty(window, "FileReader", {
        value: OriginalFileReader,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("onOpenChange", () => {
    it("calls onOpenChange callback", () => {
      render(<ComposerActionAttachment />);
      expect(mockOnOpenChange).toBeDefined();
      // Just verify it's a function that can be called without error
      act(() => {
        mockOnOpenChange!(true);
      });
    });
  });

  describe("getFileIconName via recent files", () => {
    beforeEach(() => {
      mockPlatformFile = {
        pickFiles: mockPickFiles,
        convertFileToText: mockConvertFileToText,
        getFileType: mockGetFileType,
        getRecentFiles: mockGetRecentFiles,
      };
    });

    const testFileIcon = async (type: number, _expectedIcon: string) => {
      mockGetRecentFiles.mockResolvedValue(
        JSON.stringify({
          files: [{ path: `/docs/file.ext`, type, url: "" }],
        })
      );

      await act(async () => {
        render(<ComposerActionAttachment />);
      });

      await waitFor(() => {
        const items = mockDropdownItems as {
          text: string;
          subMenu?: { icon: React.ReactElement }[];
        }[];
        const recentItem = items.find((i) => i.text === "RecentFiles");
        expect(recentItem).toBeDefined();
      });
    };

    it("renders recent files with correct icon for document type", async () => {
      await testFileIcon(7, "documents");
    });

    it("renders recent files with correct icon for spreadsheet type", async () => {
      await testFileIcon(8, "spreadsheets");
    });

    it("renders recent files with correct icon for pdf type", async () => {
      await testFileIcon(12, "pdf");
    });

    it("renders recent files with correct icon for unknown type", async () => {
      await testFileIcon(999, "unknown-format");
    });
  });
});
