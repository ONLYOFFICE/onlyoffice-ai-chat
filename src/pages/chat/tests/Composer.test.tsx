// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockUseStores = vi.fn();

vi.mock("../../../store/context", () => ({
  useStores: () => mockUseStores(),
}));

const mockUseWidgetConfig = vi.fn();

vi.mock("../../../widget-config", () => ({
  useWidgetConfig: () => mockUseWidgetConfig(),
}));

vi.mock("@assistant-ui/react", () => ({
  ComposerPrimitive: {
    Root: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <div data-testid="composer-root" {...props}>
        {children}
      </div>
    ),
    Input: (props: Record<string, unknown>) => (
      <input
        data-testid={props["data-testid"] as string}
        placeholder={props.placeholder as string}
        disabled={props.disabled as boolean}
        aria-label={props["aria-label"] as string}
      />
    ),
  },
}));

vi.mock("../sub-components/ComposerActionSelectModel", () => ({
  SelectModel: () => <div data-testid="select-model" />,
}));

vi.mock("../sub-components/ComposerAction", () => ({
  ComposerAction: () => <div data-testid="composer-action" />,
}));

vi.mock("../../../ui/components/file-item", () => ({
  FileItem: ({ file }: { file: { path?: string; name?: string } }) => (
    <div data-testid="file-item" data-path={file.path ?? file.name} />
  ),
}));

function setupStores(overrides?: {
  attachmentFiles?: { path: string; content: string; type: number }[];
  attachmentImages?: { name: string; base64: string }[];
  currentProfile?: { id: string; name: string } | null;
  hideProfilePicker?: boolean;
}) {
  mockUseStores.mockReturnValue({
    useAttachmentsStore: () => ({
      attachmentFiles: overrides?.attachmentFiles ?? [],
      attachmentImages: overrides?.attachmentImages ?? [],
    }),
    useProfilesStore: (selector?: unknown) => {
      if (typeof selector === "function") {
        return overrides?.currentProfile ?? null;
      }
      return {};
    },
    selectCurrentChatProfile: () => overrides?.currentProfile ?? null,
  });
  mockUseWidgetConfig.mockReturnValue({
    hideProfilePicker: overrides?.hideProfilePicker ?? false,
  });
}

import { Composer } from "../sub-components/Composer";

describe("Composer", () => {
  it("renders without crash", () => {
    setupStores();
    render(<Composer />);
    expect(screen.getByTestId("composer-root")).toBeInTheDocument();
  });

  it("renders disclaimer text", () => {
    setupStores();
    render(<Composer />);
    expect(screen.getByText("CheckInfo")).toBeInTheDocument();
  });

  it("renders the Ask label and select model", () => {
    setupStores();
    render(<Composer />);
    expect(screen.getByText("Ask")).toBeInTheDocument();
    expect(screen.getByTestId("select-model")).toBeInTheDocument();
  });

  it("renders composer input with placeholder", () => {
    setupStores({ currentProfile: { id: "1", name: "GPT" } });
    render(<Composer />);
    const input = screen.getByTestId("composer-input");
    expect(input).toBeInTheDocument();
    expect(input.getAttribute("placeholder")).toBe("AskAI");
  });

  it("disables input when no profile selected", () => {
    setupStores({ currentProfile: null });
    render(<Composer />);
    const input = screen.getByTestId("composer-input");
    expect(input).toBeDisabled();
  });

  it("renders file items when attachments exist", () => {
    setupStores({
      attachmentFiles: [{ path: "/doc.pdf", content: "content", type: 1 }],
      attachmentImages: [
        { name: "img.png", base64: "data:image/png;base64,abc" },
      ],
      currentProfile: { id: "1", name: "GPT" },
    });
    render(<Composer />);
    const fileItems = screen.getAllByTestId("file-item");
    expect(fileItems).toHaveLength(2);
  });

  it("does not render file items when no attachments", () => {
    setupStores({ attachmentFiles: [], attachmentImages: [] });
    render(<Composer />);
    expect(screen.queryByTestId("file-item")).not.toBeInTheDocument();
  });

  it("renders composer action buttons", () => {
    setupStores();
    render(<Composer />);
    expect(screen.getByTestId("composer-action")).toBeInTheDocument();
  });

  it("hides the Ask label and select model when hideProfilePicker is true", () => {
    setupStores({ hideProfilePicker: true });
    render(<Composer />);
    expect(screen.queryByText("Ask")).not.toBeInTheDocument();
    expect(screen.queryByTestId("select-model")).not.toBeInTheDocument();
  });
});
