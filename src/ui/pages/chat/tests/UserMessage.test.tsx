// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockAddPrompt = vi.fn();
const mockAddFolder = vi.fn().mockReturnValue("new-folder-id");
let mockFolders: { id: string; name: string }[] = [];
const mockMessageContent = {
  current: [{ type: "text", text: "Hello world" }] as unknown[],
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
}));

vi.mock("../../../../store/context", () => ({
  useStores: () => ({
    usePromptsStore: () => ({
      addPrompt: mockAddPrompt,
      addFolder: mockAddFolder,
      folders: mockFolders,
    }),
  }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("@assistant-ui/react", () => ({
  MessagePrimitive: {
    Root: ({
      children,
      asChild: _asChild,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
    }) => <div data-testid="message-root">{children}</div>,
    Content: ({ components: _components }: { components?: unknown }) => (
      <div data-testid="message-content" />
    ),
    If: ({
      children,
      copied,
    }: {
      children: React.ReactNode;
      copied?: boolean;
    }) => (
      <div
        data-testid={
          copied === true
            ? "if-copied"
            : copied === false
              ? "if-not-copied"
              : "if-unknown"
        }
      >
        {children}
      </div>
    ),
  },
  ActionBarPrimitive: {
    Root: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <div data-testid="action-bar" className={className}>
        {children}
      </div>
    ),
    Copy: ({
      children,
      asChild: _asChild,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
    }) => <div data-testid="action-copy">{children}</div>,
  },
  useMessage: () => ({
    content: mockMessageContent.current,
    status: { type: "complete" },
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      ...props
    }: {
      children?: React.ReactNode;
      initial?: unknown;
      animate?: unknown;
      [key: string]: unknown;
    }) => (
      <div data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
}));

vi.mock("../../../components/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    [key: string]: unknown;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("../../../components/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    header,
    onClose,
    className: _className,
  }: {
    children: React.ReactNode;
    header?: string;
    onClose?: () => void;
    className?: string;
  }) => (
    <div data-testid="dialog-content" data-header={header}>
      <button data-testid="dialog-close" onClick={onClose}>
        Close
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

let mockDropdownItems: unknown[] = [];
vi.mock("../../../components/dropdown", () => ({
  DropdownMenu: ({
    trigger,
    items,
    open,
    onOpenChange,
  }: {
    trigger: React.ReactNode;
    items: unknown[];
    open?: boolean;
    onOpenChange?: (val: boolean) => void;
  }) => {
    mockDropdownItems = items;
    return (
      <div data-testid="dropdown-menu" data-item-count={items.length}>
        {trigger}
        <button
          data-testid="dropdown-toggle"
          onClick={() => onOpenChange?.(!open)}
        />
      </div>
    );
  },
}));

vi.mock("../../../components/file-item", () => ({
  FileItem: ({ file }: { file: { path: string } }) => (
    <div data-testid="file-item" data-path={file.path} />
  ),
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: (props: Record<string, unknown>) => (
    <button
      data-testid={`icon-btn-${props.iconName}`}
      onClick={props.onClick as (() => void) | undefined}
    />
  ),
}));

vi.mock("../../../components/input", () => ({
  Input: ({
    value,
    onChange,
    ..._props
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    [key: string]: unknown;
  }) => <input data-testid="input" value={value} onChange={onChange} />,
}));

vi.mock("../../../components/markdown", () => ({
  MarkdownText: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="markdown-text">{children}</div>
  ),
}));

vi.mock("../../../components/tooltip-icon-button", () => ({
  TooltipIconButton: ({
    children,
    tooltip,
  }: {
    children: React.ReactNode;
    tooltip?: string;
  }) => (
    <div data-testid="tooltip-btn" data-tooltip={tooltip}>
      {children}
    </div>
  ),
}));

vi.mock("../../../../shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("../sub-components/ComposerActionPrompts", () => ({
  PROMPT_DIALOG_CLASS: "mock-class",
}));

import { UserMessage } from "../sub-components/UserMessage";

describe("UserMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFolders = [];
    mockMessageContent.current = [{ type: "text", text: "Hello world" }];
    mockDropdownItems = [];
  });

  it("renders without crash", () => {
    render(<UserMessage />);
    expect(screen.getByTestId("message-root")).toBeInTheDocument();
  });

  it("renders with data-role user", () => {
    render(<UserMessage />);
    const motionDiv = screen.getByTestId("motion-div");
    expect(motionDiv.getAttribute("data-role")).toBe("user");
  });

  it("renders with ltr direction", () => {
    render(<UserMessage />);
    const motionDiv = screen.getByTestId("motion-div");
    expect(motionDiv.getAttribute("dir")).toBe("ltr");
  });

  it("renders message content", () => {
    render(<UserMessage />);
    expect(screen.getByTestId("message-content")).toBeInTheDocument();
  });

  it("renders action bar with copy and dropdown", () => {
    render(<UserMessage />);
    expect(screen.getByTestId("action-bar")).toBeInTheDocument();
    expect(screen.getByTestId("action-copy")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
  });

  it("does not render images or files when content has only text", () => {
    const { container } = render(<UserMessage />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.queryByTestId("file-item")).not.toBeInTheDocument();
  });

  it("renders images when content has image items", () => {
    mockMessageContent.current = [
      { type: "text", text: "With images" },
      { type: "image", image: "data:image/png;base64,abc" },
      { type: "image", image: "data:image/png;base64,def" },
    ];
    const { container } = render(<UserMessage />);
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute("src")).toBe("data:image/png;base64,abc");
    expect(images[1].getAttribute("src")).toBe("data:image/png;base64,def");
  });

  it("renders files when content has file items", () => {
    mockMessageContent.current = [
      { type: "text", text: "With files" },
      {
        type: "file",
        data: "file-content-1",
        mimeType: JSON.stringify({ type: 7, path: "/path/to/doc.docx" }),
      },
    ];
    render(<UserMessage />);
    const fileItems = screen.getAllByTestId("file-item");
    expect(fileItems).toHaveLength(1);
    expect(fileItems[0].getAttribute("data-path")).toBe("/path/to/doc.docx");
  });

  it("renders both images and files together", () => {
    mockMessageContent.current = [
      { type: "text", text: "Both" },
      { type: "image", image: "data:image/png;base64,img1" },
      {
        type: "file",
        data: "content",
        mimeType: JSON.stringify({ type: 7, path: "/doc.docx" }),
      },
    ];
    const { container } = render(<UserMessage />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getAllByTestId("file-item")).toHaveLength(1);
  });

  it("renders copy button with tooltip", () => {
    render(<UserMessage />);
    const tooltips = screen.getAllByTestId("tooltip-btn");
    const copyTooltip = tooltips.find(
      (el) => el.getAttribute("data-tooltip") === "CopyToClipboard"
    );
    expect(copyTooltip).toBeInTheDocument();
  });

  it("renders copied and not-copied icon states", () => {
    render(<UserMessage />);
    expect(screen.getByTestId("icon-btn-checked")).toBeInTheDocument();
    expect(screen.getByTestId("icon-btn-btn-copy")).toBeInTheDocument();
  });

  it("renders the more button in dropdown trigger", () => {
    render(<UserMessage />);
    expect(screen.getByTestId("icon-btn-more")).toBeInTheDocument();
  });

  describe("UserActionBar dropdown items", () => {
    it("has SaveAIPrompt and SaveAIPromptToTable items", () => {
      render(<UserMessage />);
      expect(mockDropdownItems).toHaveLength(2);
      const items = mockDropdownItems as {
        text: string;
        onClick: () => void;
        subMenu?: unknown[];
      }[];
      expect(items[0].text).toBe("SaveAIPrompt");
      expect(items[1].text).toBe("SaveAIPromptToTable");
    });

    it("SaveAIPrompt calls addPrompt with message text", () => {
      render(<UserMessage />);
      const items = mockDropdownItems as {
        text: string;
        onClick: () => void;
      }[];
      items[0].onClick();
      expect(mockAddPrompt).toHaveBeenCalledWith("Hello world");
    });

    it("SaveAIPrompt joins multiple text items with newline", () => {
      mockMessageContent.current = [
        { type: "text", text: "Line 1" },
        { type: "text", text: "Line 2" },
        { type: "image", image: "img" },
      ];
      render(<UserMessage />);
      const items = mockDropdownItems as {
        text: string;
        onClick: () => void;
      }[];
      items[0].onClick();
      expect(mockAddPrompt).toHaveBeenCalledWith("Line 1\nLine 2");
    });

    it("SaveAIPromptToTable has subMenu with NewFolder option", () => {
      render(<UserMessage />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const subMenu = items[1].subMenu!;
      expect(subMenu).toHaveLength(1);
      expect(subMenu[0].text).toBe("NewFolder");
    });

    it("SaveAIPromptToTable includes folders in subMenu when folders exist", () => {
      mockFolders = [
        { id: "f1", name: "Folder A" },
        { id: "f2", name: "Folder B" },
      ];
      render(<UserMessage />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const subMenu = items[1].subMenu!;
      // 2 folders + 1 separator + 1 NewFolder = 4
      expect(subMenu).toHaveLength(4);
      expect(subMenu[0].text).toBe("Folder A");
      expect(subMenu[1].text).toBe("Folder B");
      expect(subMenu[2].text).toBe(""); // separator
      expect(subMenu[3].text).toBe("NewFolder");
    });

    it("clicking a folder in subMenu calls addPrompt with folderId", () => {
      mockFolders = [{ id: "f1", name: "Folder A" }];
      render(<UserMessage />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      items[1].subMenu![0].onClick();
      expect(mockAddPrompt).toHaveBeenCalledWith("Hello world", "f1");
    });

    it("clicking NewFolder opens the NewFolderDialog", () => {
      render(<UserMessage />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const newFolderItem = items[1].subMenu!.find(
        (i: { text: string }) => i.text === "NewFolder"
      )!;
      act(() => {
        newFolderItem.onClick();
      });
      expect(screen.getByTestId("dialog")).toBeInTheDocument();
      expect(
        screen.getByTestId("dialog-content").getAttribute("data-header")
      ).toBe("NewAIPromptFolder");
    });
  });

  describe("NewFolderDialog", () => {
    function openNewFolderDialog() {
      render(<UserMessage />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const newFolderItem = items[1].subMenu!.find(
        (i: { text: string }) => i.text === "NewFolder"
      )!;
      act(() => {
        newFolderItem.onClick();
      });
    }

    it("renders with default folder name from translation", () => {
      openNewFolderDialog();
      const input = screen.getByTestId("input") as HTMLInputElement;
      expect(input.value).toBe("NewFolder");
    });

    it("Save button is enabled with default name", () => {
      openNewFolderDialog();
      const buttons = screen.getAllByRole("button");
      const saveBtn = buttons.find((b) => b.textContent === "Save");
      expect(saveBtn).not.toBeDisabled();
    });

    it("Save button is disabled when folder name is empty", () => {
      openNewFolderDialog();
      const input = screen.getByTestId("input");
      fireEvent.change(input, { target: { value: "   " } });
      const buttons = screen.getAllByRole("button");
      const saveBtn = buttons.find((b) => b.textContent === "Save");
      expect(saveBtn).toBeDisabled();
    });

    it("clicking Save calls addFolder and addPrompt then closes", () => {
      openNewFolderDialog();
      const buttons = screen.getAllByRole("button");
      const saveBtn = buttons.find((b) => b.textContent === "Save")!;
      fireEvent.click(saveBtn);
      expect(mockAddFolder).toHaveBeenCalledWith("NewFolder");
      expect(mockAddPrompt).toHaveBeenCalledWith(
        "Hello world",
        "new-folder-id"
      );
      // Dialog should be closed after save
      const dialogContent = screen.queryByTestId("dialog-content");
      expect(
        dialogContent === null ||
          dialogContent.getAttribute("data-header") !== "NewAIPromptFolder"
      ).toBe(true);
    });

    it("submitting the form calls onSave", () => {
      openNewFolderDialog();
      const form = screen.getByTestId("dialog-content").querySelector("form")!;
      fireEvent.submit(form);
      expect(mockAddFolder).toHaveBeenCalled();
    });

    it("clicking Cancel closes the dialog", () => {
      openNewFolderDialog();
      const closeBtn = screen.getByTestId("dialog-close");
      fireEvent.click(closeBtn);
      // Dialog should be gone after close
      expect(screen.queryByText("NewAIPromptFolder")).not.toBeInTheDocument();
    });

    it("updating folder name and saving uses new name", () => {
      openNewFolderDialog();
      const input = screen.getByTestId("input");
      fireEvent.change(input, { target: { value: "My Custom Folder" } });
      const buttons = screen.getAllByRole("button");
      const saveBtn = buttons.find((b) => b.textContent === "Save")!;
      fireEvent.click(saveBtn);
      expect(mockAddFolder).toHaveBeenCalledWith("My Custom Folder");
    });
  });
});
