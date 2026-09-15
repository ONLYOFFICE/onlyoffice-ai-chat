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
    usePromptsStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        prompts: mockPrompts,
        folders: mockFolders,
        editPrompt: mockEditPrompt,
        removePrompt: mockRemovePrompt,
        renameFolder: mockRenameFolder,
        removeFolder: mockRemoveFolder,
        addFolder: mockAddFolder,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
  }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("@assistant-ui/react", () => ({
  useComposerRuntime: () => ({
    setText: mockSetText,
  }),
}));

let mockDropdownItems: unknown[] = [];
let mockOnOpenChange: ((val: boolean) => void) | undefined;
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
    mockOnOpenChange = onOpenChange;
    return (
      <div
        data-testid="dropdown-menu"
        data-item-count={items.length}
        data-open={String(open)}
      >
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
    cancelLabel,
    onCancel,
    cancelType,
    submitLabel,
    onSubmit,
    submitType,
    submitDisabled,
  }: {
    cancelLabel: string;
    onCancel?: () => void;
    cancelType?: "button" | "submit" | "reset";
    submitLabel: string;
    onSubmit?: () => void;
    submitType?: "button" | "submit" | "reset";
    submitDisabled?: boolean;
  }) => (
    <div data-testid="dialog-footer">
      <button type={cancelType ?? "button"} onClick={onCancel}>
        {cancelLabel}
      </button>
      <button
        type={submitType ?? "button"}
        onClick={onSubmit}
        disabled={submitDisabled}
      >
        {submitLabel}
      </button>
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
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    [key: string]: unknown;
  }) => <input data-testid="input" value={value} onChange={onChange} />,
}));

vi.mock("../../../../shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { ComposerActionPrompts } from "../sub-components/ComposerActionPrompts";
import { WidgetConfigProvider } from "../../../../widget-config";

describe("ComposerActionPrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrompts = [];
    mockFolders = [];
    mockDropdownItems = [];
    mockOnOpenChange = undefined;
  });

  // Drive the controlled menu open the way Radix would (via onOpenChange), so
  // "closes on action" assertions have a real open→closed transition to check.
  const openMenu = () => act(() => mockOnOpenChange?.(true));
  const isMenuOpen = () =>
    screen.getByTestId("dropdown-menu").getAttribute("data-open") === "true";

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

  // Drill-down navigation addresses rows by `id`, so every row that can be
  // descended into needs one that survives the tree being rebuilt around it —
  // moving a prompt into a folder shifts every index after it at the root.
  it("gives prompt, folder and context-menu rows stable ids", () => {
    mockPrompts = [
      { id: "1", name: "Prompt A", text: "text A", folderId: null },
      { id: "2", name: "Prompt B", text: "text B", folderId: "f1" },
    ];
    mockFolders = [{ id: "f1", name: "Folder 1" }];
    render(<ComposerActionPrompts />);
    const items = mockDropdownItems as {
      id?: string;
      isSeparator?: boolean;
      subMenu?: { id?: string; isSeparator?: boolean }[];
    }[];

    expect(items[0].id).toBe("prompt:1");
    // The separator is never a navigation target, so it needs no id.
    expect(items[1].isSeparator).toBe(true);
    expect(items[2].id).toBe("folder:f1");

    expect(items[2].subMenu?.[0].id).toBe("prompt:2");
    const context = items[0].subMenu as { id?: string }[];
    expect(context[0].id).toBe("edit:1");
    expect(context[1].id).toBe("move:1");

    const ids = items
      .filter((i) => !i.isSeparator)
      .map((i) => i.id)
      .filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe("prompt actions", () => {
    it("clicking a prompt applies its text via composerRuntime.setText and closes the menu", () => {
      mockPrompts = [
        { id: "1", name: "My Prompt", text: "Apply this text", folderId: null },
      ];
      render(<ComposerActionPrompts />);
      openMenu();
      expect(isMenuOpen()).toBe(true);
      const items = mockDropdownItems as {
        text: string;
        onClick: () => void;
      }[];
      act(() => items[0].onClick());
      expect(mockSetText).toHaveBeenCalledWith("Apply this text");
      expect(isMenuOpen()).toBe(false);
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
      type SubMenuItem = {
        text: string;
        onClick?: () => void;
        subMenu?: SubMenuItem[];
      };
      const items = mockDropdownItems as {
        text: string;
        subMenu?: SubMenuItem[];
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
      act(() => moveToFolder.subMenu![0].onClick());
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
      act(() => savedPrompts.onClick());
      expect(mockEditPrompt).toHaveBeenCalledWith("1", { folderId: null });
    });

    it("Delete onClick confirms first instead of removing", () => {
      mockPrompts = [{ id: "1", name: "Prompt", text: "text", folderId: null }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const deleteItem = items[0].subMenu!.find(
        (i: { text: string }) => i.text === "Delete"
      )!;
      act(() => deleteItem.onClick());
      expect(screen.getByText("WantDeletePrompt")).toBeInTheDocument();
      expect(mockRemovePrompt).not.toHaveBeenCalled();
    });
  });

  describe("closes the menu on leaf actions", () => {
    it("closes when a prompt is edited (built-in dialog path)", () => {
      mockPrompts = [{ id: "p1", name: "P", text: "T", folderId: null }];
      render(<ComposerActionPrompts />);
      openMenu();
      expect(isMenuOpen()).toBe(true);
      const items = mockDropdownItems as {
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const editItem = items[0].subMenu!.find(
        (i) => i.text === "EditAIPrompt"
      )!;
      act(() => editItem.onClick());
      expect(isMenuOpen()).toBe(false);
    });

    it("closes when a prompt is deleted", () => {
      mockPrompts = [{ id: "p1", name: "P", text: "T", folderId: null }];
      render(<ComposerActionPrompts />);
      openMenu();
      const items = mockDropdownItems as {
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const deleteItem = items[0].subMenu!.find((i) => i.text === "Delete")!;
      act(() => deleteItem.onClick());
      expect(isMenuOpen()).toBe(false);
    });

    it("closes when a folder is renamed (built-in dialog path)", () => {
      mockFolders = [{ id: "f1", name: "My Folder" }];
      render(<ComposerActionPrompts />);
      openMenu();
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const folderItem = items.find((i) => i.text === "My Folder")!;
      const renameItem = folderItem.subMenu!.find(
        (i) => i.text === "RenameFolder"
      )!;
      // Block body: this item's onClick returns the async requestRenameFolder
      // promise; returning it from the act callback would switch act to async
      // mode. We only care about the synchronous state flush (closeMenu).
      act(() => {
        renameItem.onClick();
      });
      expect(isMenuOpen()).toBe(false);
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

  describe("DeletePromptDialog", () => {
    function openDeleteDialog() {
      mockPrompts = [{ id: "p1", name: "My Prompt", text: "t", folderId: null }];
      render(<ComposerActionPrompts />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const deleteItem = items[0].subMenu!.find(
        (i: { text: string }) => i.text === "Delete"
      )!;
      act(() => {
        deleteItem.onClick();
      });
    }

    it("opens delete dialog titled after the action", () => {
      openDeleteDialog();
      const dialogContent = screen.getByTestId("dialog-content");
      expect(dialogContent.getAttribute("data-header")).toBe("DeletePrompt");
      expect(dialogContent.getAttribute("data-warning")).toBe("true");
    });

    it("shows confirmation message", () => {
      openDeleteDialog();
      expect(screen.getByText("WantDeletePrompt")).toBeInTheDocument();
    });

    it("clicking the confirm button deletes the prompt", () => {
      openDeleteDialog();
      const buttons = screen.getAllByRole("button");
      const confirmBtn = buttons.find(
        (b) => b.textContent === "DeletePromptConfirm"
      )!;
      fireEvent.click(confirmBtn);
      expect(mockRemovePrompt).toHaveBeenCalledWith("p1");
    });

    it("closing the dialog keeps the prompt", () => {
      openDeleteDialog();
      const closeBtn = screen.getByTestId("dialog-close");
      fireEvent.click(closeBtn);
      expect(mockRemovePrompt).not.toHaveBeenCalled();
    });

    it("pressing Enter triggers confirm", () => {
      openDeleteDialog();
      const confirmText = screen.getByText("WantDeletePrompt");
      const container = confirmText.closest("div[class*='flex']")!;
      fireEvent.keyDown(container, { key: "Enter" });
      expect(mockRemovePrompt).toHaveBeenCalledWith("p1");
    });
  });

  describe("onDeletePrompt host handler", () => {
    const renderWithHandler = (
      onDeletePrompt: (name: string, id: string) => boolean | Promise<boolean>
    ) => {
      mockPrompts = [{ id: "p1", name: "My Prompt", text: "t", folderId: null }];
      render(
        <WidgetConfigProvider config={{ onDeletePrompt }}>
          <ComposerActionPrompts />
        </WidgetConfigProvider>
      );
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      const deleteItem = items[0].subMenu!.find(
        (i: { text: string }) => i.text === "Delete"
      )!;
      return deleteItem;
    };

    it("delegates to the host instead of the built-in dialog", async () => {
      const onDeletePrompt = vi.fn().mockResolvedValue(true);
      const deleteItem = renderWithHandler(onDeletePrompt);
      await act(async () => {
        deleteItem.onClick();
      });
      expect(onDeletePrompt).toHaveBeenCalledWith("My Prompt", "p1");
      expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
      expect(mockRemovePrompt).toHaveBeenCalledWith("p1");
    });

    it("keeps the prompt when the host does not confirm", async () => {
      const deleteItem = renderWithHandler(vi.fn().mockResolvedValue(false));
      await act(async () => {
        deleteItem.onClick();
      });
      expect(mockRemovePrompt).not.toHaveBeenCalled();
    });

    it("keeps the prompt when the host handler throws", async () => {
      const deleteItem = renderWithHandler(
        vi.fn().mockRejectedValue(new Error("boom"))
      );
      await act(async () => {
        deleteItem.onClick();
      });
      expect(mockRemovePrompt).not.toHaveBeenCalled();
    });
  });

  describe("built-in prompts (host suggestions)", () => {
    const renderWithSuggestions = (
      suggestions: { name: string; prompt: string }[]
    ) =>
      render(
        <WidgetConfigProvider config={{ suggestions }}>
          <ComposerActionPrompts />
        </WidgetConfigProvider>
      );

    it("renders the built-in-prompts folder when only suggestions exist", () => {
      renderWithSuggestions([{ name: "S1", prompt: "P1" }]);
      expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; onClick: () => void }[];
      }[];
      expect(items).toHaveLength(1);
      expect(items[0].text).toBe("built-in-prompts");
      expect(items[0].subMenu).toHaveLength(1);
      act(() => items[0].subMenu![0].onClick());
      expect(mockSetText).toHaveBeenCalledWith("P1");
    });

    it("built-in rows are read-only: no context menu, no folder actions", () => {
      renderWithSuggestions([
        { name: "S1", prompt: "P1" },
        { name: "S2", prompt: "P2" },
      ]);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; subMenu?: unknown }[];
      }[];
      const folder = items[items.length - 1];
      expect(folder.text).toBe("built-in-prompts");
      const rows = folder.subMenu!;
      expect(rows.map((r) => r.text)).toEqual(["S1", "S2"]);
      // No per-row context menu (edit / move / delete)...
      for (const row of rows) expect(row.subMenu).toBeUndefined();
      // ...and no rename/delete entries on the folder itself.
      expect(rows.some((r) => r.text === "RenameFolder")).toBe(false);
      expect(rows.some((r) => r.text === "DeleteFolder")).toBe(false);
    });

    it("appends after user folders and separates from root prompts", () => {
      mockPrompts = [{ id: "1", name: "Prompt A", text: "a", folderId: null }];
      mockFolders = [{ id: "f1", name: "Folder 1" }];
      renderWithSuggestions([{ name: "S1", prompt: "P1" }]);
      const items = mockDropdownItems as {
        text: string;
        isSeparator?: boolean;
      }[];
      // prompt + separator + user folder + built-in folder
      expect(items).toHaveLength(4);
      expect(items[1].isSeparator).toBe(true);
      expect(items[3].text).toBe("built-in-prompts");
    });

    it("skips malformed suggestions and hides the folder when none are valid", () => {
      const { container } = renderWithSuggestions([
        { name: "", prompt: "P" },
        { name: "N", prompt: "" },
      ]);
      expect(container.innerHTML).toBe("");
    });
  });
});
