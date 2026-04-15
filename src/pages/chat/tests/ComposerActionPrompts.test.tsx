// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockSetText = vi.fn();
const mockEditPrompt = vi.fn();
const mockRemovePrompt = vi.fn();
const mockRenameFolder = vi.fn();
const mockRemoveFolder = vi.fn();
const mockAddFolder = vi.fn().mockReturnValue("new-folder-id");

let mockPrompts: {
  id: string;
  name: string;
  text: string;
  folderId?: string | null;
}[] = [];
let mockFolders: { id: string; name: string }[] = [];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    usePromptsStore: () => ({
      prompts: mockPrompts,
      folders: mockFolders,
      editPrompt: mockEditPrompt,
      removePrompt: mockRemovePrompt,
      renameFolder: mockRenameFolder,
      removeFolder: mockRemoveFolder,
      addFolder: mockAddFolder,
    }),
  }),
}));

vi.mock("../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("@assistant-ui/react", () => ({
  useComposerRuntime: () => ({
    setText: mockSetText,
  }),
}));

let mockDropdownItems: unknown[] = [];
vi.mock("../../../components/dropdown", () => ({
  DropdownMenu: ({
    trigger,
    items,
    onOpenChange: _onOpenChange,
  }: {
    trigger: React.ReactNode;
    items: unknown[];
    onOpenChange?: (val: boolean) => void;
  }) => {
    mockDropdownItems = items;
    return (
      <div data-testid="dropdown-menu" data-item-count={items.length}>
        {trigger}
      </div>
    );
  },
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: (props: Record<string, unknown>) => (
    <button data-testid={`icon-btn-${props.iconName}`} />
  ),
}));

vi.mock("../../../components/tooltip-icon-button", () => ({
  TooltipIconButton: ({
    children,
    visible,
    tooltip,
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
    withWarningIcon,
  }: {
    children: React.ReactNode;
    header?: string;
    onClose?: () => void;
    className?: string;
    withWarningIcon?: boolean;
  }) => (
    <div
      data-testid="dialog-content"
      data-header={header}
      data-warning={withWarningIcon}
    >
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

vi.mock("../../../components/field-container", () => ({
  FieldContainer: ({
    children,
    header,
  }: {
    children: React.ReactNode;
    header?: string;
  }) => (
    <div data-testid="field-container" data-header={header}>
      {children}
    </div>
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

vi.mock("../../../lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { ComposerActionPrompts } from "../sub-components/ComposerActionPrompts";

describe("ComposerActionPrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrompts = [];
    mockFolders = [];
    mockDropdownItems = [];
  });

  it("returns null when no prompts and no folders", () => {
    const { container } = render(<ComposerActionPrompts />);
    expect(container.innerHTML).toBe("");
  });

  it("renders dropdown when prompts exist", () => {
    mockPrompts = [
      { id: "1", name: "My Prompt", text: "Hello", folderId: null },
    ];
    render(<ComposerActionPrompts />);
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
  });

  it("renders dropdown when only folders exist", () => {
    mockFolders = [{ id: "f1", name: "Folder 1" }];
    render(<ComposerActionPrompts />);
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
  });

  it("renders trigger with SavedPrompts tooltip", () => {
    mockPrompts = [{ id: "1", name: "Prompt", text: "text", folderId: null }];
    render(<ComposerActionPrompts />);
    const tooltip = screen.getByTestId("tooltip-btn");
    expect(tooltip.getAttribute("data-tooltip")).toBe("SavedPrompts");
  });

  it("renders items for each root prompt", () => {
    mockPrompts = [
      { id: "1", name: "Prompt A", text: "text A", folderId: null },
      { id: "2", name: "Prompt B", text: "text B", folderId: null },
    ];
    render(<ComposerActionPrompts />);
    expect(mockDropdownItems).toHaveLength(2);
    const items = mockDropdownItems as { text: string }[];
    expect(items[0].text).toBe("Prompt A");
    expect(items[1].text).toBe("Prompt B");
  });

  it("renders items for prompts and folders with separator", () => {
    mockPrompts = [
      { id: "1", name: "Prompt A", text: "text A", folderId: null },
    ];
    mockFolders = [{ id: "f1", name: "Folder 1" }];
    render(<ComposerActionPrompts />);
    // 1 prompt + 1 separator + 1 folder = 3
    expect(mockDropdownItems).toHaveLength(3);
  });

  it("does not render separator when no root prompts but has folders", () => {
    mockPrompts = [
      { id: "1", name: "Prompt A", text: "text A", folderId: "f1" },
    ];
    mockFolders = [{ id: "f1", name: "Folder 1" }];
    render(<ComposerActionPrompts />);
    // 0 root prompts + 0 separator + 1 folder = 1
    expect(mockDropdownItems).toHaveLength(1);
  });

  describe("prompt actions", () => {
    it("clicking a prompt applies its text via composerRuntime.setText", () => {
      mockPrompts = [
        { id: "1", name: "My Prompt", text: "Apply this text", folderId: null },
      ];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        onClick: () => void;
      }[];
      items[0].onClick();
      expect(mockSetText).toHaveBeenCalledWith("Apply this text");
    });

    it("prompt has context menu with Edit, Delete, and separator", () => {
      mockPrompts = [{ id: "1", name: "Prompt", text: "text", folderId: null }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string }[];
      }[];
      const subMenu = items[0].subMenu!;
      expect(subMenu).toHaveLength(3); // Edit + separator + Delete
      expect(subMenu[0].text).toBe("EditAIPrompt");
      expect(subMenu[1].text).toBe(""); // separator
      expect(subMenu[2].text).toBe("Delete");
    });

    it("prompt context menu includes MoveToFolder when folders exist", () => {
      mockPrompts = [{ id: "1", name: "Prompt", text: "text", folderId: null }];
      mockFolders = [{ id: "f1", name: "Folder 1" }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; subMenu?: { text: string }[] }[];
      }[];
      const subMenu = items[0].subMenu!;
      expect(subMenu).toHaveLength(4); // Edit + MoveToFolder + separator + Delete
      expect(subMenu[1].text).toBe("MoveToFolder");
      expect(subMenu[1].subMenu).toHaveLength(1);
      expect(subMenu[1].subMenu![0].text).toBe("Folder 1");
    });

    it("MoveToFolder includes 'SavedPrompts' option for prompts in a folder", () => {
      mockPrompts = [{ id: "1", name: "Prompt", text: "text", folderId: "f1" }];
      mockFolders = [
        { id: "f1", name: "Folder 1" },
        { id: "f2", name: "Folder 2" },
      ];
      render(<ComposerActionPrompts />);
      // This prompt is in a folder, so it shows in the folder's subMenu
      const items = mockDropdownItems as {
        text: string;
        subMenu?: {
          text: string;
          subMenu?: { text: string; onClick: () => void }[];
        }[];
      }[];
      // The folder item
      const folderItem = items.find((i) => i.text === "Folder 1")!;
      // First item in folder is the prompt
      const promptItem = folderItem.subMenu![0];
      const moveMenu = promptItem.subMenu!;
      // Should have Edit + MoveToFolder + separator + Delete
      const moveToFolder = moveMenu.find(
        (i: { text: string }) => i.text === "MoveToFolder"
      )!;
      // MoveToFolder subMenu: SavedPrompts (move to root) + Folder 2 (not current folder)
      expect(moveToFolder.subMenu).toHaveLength(2);
      expect(moveToFolder.subMenu![0].text).toBe("SavedPrompts");
      expect(moveToFolder.subMenu![1].text).toBe("Folder 2");
    });

    it("MoveToFolder onClick moves prompt to folder", () => {
      mockPrompts = [{ id: "1", name: "Prompt", text: "text", folderId: null }];
      mockFolders = [{ id: "f1", name: "Folder 1" }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: {
          text: string;
          subMenu?: { text: string; onClick: () => void }[];
        }[];
      }[];
      const moveToFolder = items[0].subMenu!.find(
        (i: { text: string }) => i.text === "MoveToFolder"
      )!;
      moveToFolder.subMenu![0].onClick();
      expect(mockEditPrompt).toHaveBeenCalledWith("1", { folderId: "f1" });
    });

    it("MoveToFolder 'SavedPrompts' moves prompt to root", () => {
      mockPrompts = [{ id: "1", name: "Prompt", text: "text", folderId: "f1" }];
      mockFolders = [{ id: "f1", name: "Folder 1" }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: {
          text: string;
          subMenu?: {
            text: string;
            subMenu?: { text: string; onClick: () => void }[];
          }[];
        }[];
      }[];
      // Prompt is in folder, so look inside folder's subMenu
      const folderItem = items.find((i) => i.text === "Folder 1")!;
      const promptItem = folderItem.subMenu![0];
      const contextMenu = promptItem.subMenu!;
      const moveToFolder = contextMenu.find(
        (i: { text: string }) => i.text === "MoveToFolder"
      )!;
      const savedPrompts = moveToFolder.subMenu!.find(
        (i: { text: string }) => i.text === "SavedPrompts"
      )!;
      savedPrompts.onClick();
      expect(mockEditPrompt).toHaveBeenCalledWith("1", { folderId: null });
    });

    it("Delete onClick calls removePrompt", () => {
      mockPrompts = [{ id: "1", name: "Prompt", text: "text", folderId: null }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const deleteItem = items[0].subMenu!.find(
        (i: { text: string }) => i.text === "Delete"
      )!;
      deleteItem.onClick();
      expect(mockRemovePrompt).toHaveBeenCalledWith("1");
    });
  });

  describe("folder items", () => {
    it("renders folder with rename and delete actions in subMenu", () => {
      mockFolders = [{ id: "f1", name: "Folder 1" }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string }[];
      }[];
      const folderItem = items.find((i) => i.text === "Folder 1")!;
      expect(folderItem.subMenu).toHaveLength(2); // rename + delete (no separator since no prompts)
      expect(folderItem.subMenu![0].text).toBe("RenameFolder");
      expect(folderItem.subMenu![1].text).toBe("DeleteFolder");
    });

    it("renders folder prompts in subMenu with separator before actions", () => {
      mockPrompts = [
        { id: "1", name: "Folder Prompt", text: "text", folderId: "f1" },
      ];
      mockFolders = [{ id: "f1", name: "Folder 1" }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string }[];
      }[];
      const folderItem = items.find((i) => i.text === "Folder 1")!;
      // prompt + separator + rename + delete = 4
      expect(folderItem.subMenu).toHaveLength(4);
      expect(folderItem.subMenu![0].text).toBe("Folder Prompt");
      expect(folderItem.subMenu![1].text).toBe(""); // separator
      expect(folderItem.subMenu![2].text).toBe("RenameFolder");
      expect(folderItem.subMenu![3].text).toBe("DeleteFolder");
    });
  });

  describe("EditPromptDialog", () => {
    function openEditDialog() {
      mockPrompts = [
        { id: "p1", name: "Test Prompt", text: "Test text", folderId: null },
      ];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const editItem = items[0].subMenu!.find(
        (i: { text: string }) => i.text === "EditAIPrompt"
      )!;
      act(() => {
        editItem.onClick();
      });
    }

    it("opens edit dialog with correct header", () => {
      openEditDialog();
      const dialogContent = screen.getByTestId("dialog-content");
      expect(dialogContent.getAttribute("data-header")).toBe("EditAIPrompt");
    });

    it("renders name input and textarea", () => {
      openEditDialog();
      expect(screen.getByTestId("input")).toBeInTheDocument();
      const textareas = document.querySelectorAll("textarea");
      expect(textareas.length).toBe(1);
      expect(textareas[0].value).toBe("Test text");
    });

    it("renders field containers for name and text", () => {
      openEditDialog();
      const containers = screen.getAllByTestId("field-container");
      expect(containers).toHaveLength(2);
      expect(containers[0].getAttribute("data-header")).toBe("PromptName");
      expect(containers[1].getAttribute("data-header")).toBe("PromptText");
    });

    it("clicking Save calls editPrompt and closes dialog", () => {
      openEditDialog();
      const buttons = screen.getAllByRole("button");
      const saveBtn = buttons.find((b) => b.textContent === "Save")!;
      fireEvent.click(saveBtn);
      expect(mockEditPrompt).toHaveBeenCalledWith("p1", {
        name: "Test Prompt",
        text: "Test text",
      });
    });

    it("Save is disabled when name is empty", () => {
      openEditDialog();
      const input = screen.getByTestId("input");
      fireEvent.change(input, { target: { value: "   " } });
      const buttons = screen.getAllByRole("button");
      const saveBtn = buttons.find((b) => b.textContent === "Save")!;
      expect(saveBtn).toBeDisabled();
    });

    it("does not call editPrompt when name is empty and Save clicked", () => {
      openEditDialog();
      const input = screen.getByTestId("input");
      fireEvent.change(input, { target: { value: "" } });
      const buttons = screen.getAllByRole("button");
      const saveBtn = buttons.find((b) => b.textContent === "Save")!;
      fireEvent.click(saveBtn);
      expect(mockEditPrompt).not.toHaveBeenCalled();
    });

    it("Cancel closes the dialog", () => {
      openEditDialog();
      const closeBtn = screen.getByTestId("dialog-close");
      fireEvent.click(closeBtn);
      expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
    });

    it("updates text via textarea", () => {
      openEditDialog();
      const textarea = document.querySelector(
        "textarea"
      ) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "Updated text" } });
      expect(textarea.value).toBe("Updated text");
    });

    it("Ctrl+Enter triggers save", () => {
      openEditDialog();
      fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
      expect(mockEditPrompt).toHaveBeenCalledWith("p1", {
        name: "Test Prompt",
        text: "Test text",
      });
    });

    it("Meta+Enter triggers save", () => {
      openEditDialog();
      fireEvent.keyDown(window, { key: "Enter", metaKey: true });
      expect(mockEditPrompt).toHaveBeenCalledWith("p1", {
        name: "Test Prompt",
        text: "Test text",
      });
    });

    it("Enter without modifier does not trigger save", () => {
      openEditDialog();
      fireEvent.keyDown(window, { key: "Enter" });
      expect(mockEditPrompt).not.toHaveBeenCalled();
    });
  });

  describe("RenameFolderDialog", () => {
    function openRenameDialog() {
      mockFolders = [{ id: "f1", name: "My Folder" }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const folderItem = items.find((i) => i.text === "My Folder")!;
      const renameItem = folderItem.subMenu!.find(
        (i: { text: string }) => i.text === "RenameFolder"
      )!;
      act(() => {
        renameItem.onClick();
      });
    }

    it("opens rename dialog with correct header", () => {
      openRenameDialog();
      const dialogContent = screen.getByTestId("dialog-content");
      expect(dialogContent.getAttribute("data-header")).toBe("RenameFolder");
    });

    it("renders input with initial folder name", () => {
      openRenameDialog();
      const input = screen.getByTestId("input") as HTMLInputElement;
      expect(input.value).toBe("My Folder");
    });

    it("clicking Save renames folder", () => {
      openRenameDialog();
      const input = screen.getByTestId("input");
      fireEvent.change(input, { target: { value: "Renamed Folder" } });
      const buttons = screen.getAllByRole("button");
      const saveBtn = buttons.find((b) => b.textContent === "Save")!;
      fireEvent.click(saveBtn);
      expect(mockRenameFolder).toHaveBeenCalledWith("f1", "Renamed Folder");
    });

    it("Save is disabled with empty name", () => {
      openRenameDialog();
      const input = screen.getByTestId("input");
      fireEvent.change(input, { target: { value: "   " } });
      const buttons = screen.getAllByRole("button");
      const saveBtn = buttons.find((b) => b.textContent === "Save")!;
      expect(saveBtn).toBeDisabled();
    });

    it("does not rename when name is empty", () => {
      openRenameDialog();
      const input = screen.getByTestId("input");
      fireEvent.change(input, { target: { value: "" } });
      const buttons = screen.getAllByRole("button");
      const saveBtn = buttons.find((b) => b.textContent === "Save")!;
      fireEvent.click(saveBtn);
      expect(mockRenameFolder).not.toHaveBeenCalled();
    });

    it("form submit triggers save", () => {
      openRenameDialog();
      const form = screen.getByTestId("dialog-content").querySelector("form")!;
      fireEvent.submit(form);
      expect(mockRenameFolder).toHaveBeenCalledWith("f1", "My Folder");
    });

    it("Cancel closes the dialog", () => {
      openRenameDialog();
      const closeBtn = screen.getByTestId("dialog-close");
      fireEvent.click(closeBtn);
      expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
    });
  });

  describe("DeleteFolderDialog", () => {
    function openDeleteDialog() {
      mockFolders = [{ id: "f1", name: "My Folder" }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const folderItem = items.find((i) => i.text === "My Folder")!;
      const deleteItem = folderItem.subMenu!.find(
        (i: { text: string }) => i.text === "DeleteFolder"
      )!;
      act(() => {
        deleteItem.onClick();
      });
    }

    it("opens delete dialog with Warning header", () => {
      openDeleteDialog();
      const dialogContent = screen.getByTestId("dialog-content");
      expect(dialogContent.getAttribute("data-header")).toBe("Warning");
      expect(dialogContent.getAttribute("data-warning")).toBe("true");
    });

    it("shows confirmation message", () => {
      openDeleteDialog();
      expect(screen.getByText("WantDeleteFolder")).toBeInTheDocument();
    });

    it("clicking Yes deletes the folder", () => {
      openDeleteDialog();
      const buttons = screen.getAllByRole("button");
      const yesBtn = buttons.find((b) => b.textContent === "Yes")!;
      fireEvent.click(yesBtn);
      expect(mockRemoveFolder).toHaveBeenCalledWith("f1");
    });

    it("clicking No closes the dialog", () => {
      openDeleteDialog();
      const closeBtn = screen.getByTestId("dialog-close");
      fireEvent.click(closeBtn);
      expect(mockRemoveFolder).not.toHaveBeenCalled();
    });

    it("pressing Enter triggers confirm", () => {
      openDeleteDialog();
      const confirmText = screen.getByText("WantDeleteFolder");
      const container = confirmText.closest("div[class*='flex']")!;
      fireEvent.keyDown(container, { key: "Enter" });
      expect(mockRemoveFolder).toHaveBeenCalledWith("f1");
    });
  });
});
