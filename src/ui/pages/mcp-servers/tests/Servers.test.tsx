// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

const mockServersInstance = {
  getCustomServers: () => ({ "custom-1": [] }),
  getHostToolGroupIds: () => ["host-editor"],
};
const mockToolsContext = { servers: mockServersInstance };

vi.mock("../../../tools/context", () => ({
  useToolsContext: () => mockToolsContext,
}));

const mockServersStoreState = {
  servers: {
    "host-editor": [{ name: "t1", description: "", inputSchema: {} }],
  },
};

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useServersStore: (selector?: (s: unknown) => unknown) => {
      return typeof selector === "function"
        ? selector(mockServersStoreState)
        : mockServersStoreState;
    },
  }),
}));

vi.mock("../../../components/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("../sub-components/AvailableTools", () => ({
  default: ({ withHeader }: { withHeader?: boolean }) => (
    <div data-testid="available-tools" data-with-header={String(withHeader)} />
  ),
}));

vi.mock("../sub-components/ConfigEditor", () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div
      data-testid="config-editor"
      data-open={String(open)}
      onClick={onClose}
    />
  ),
}));

vi.mock("../sub-components/ToolsCounter", () => ({
  default: () => <div data-testid="tools-counter" />,
}));

import { Servers } from "../sub-components";

describe("Servers", () => {
  it("renders description text", () => {
    render(<Servers />);
    expect(screen.getByText("MCPServersDescription")).toBeInTheDocument();
  });

  it("renders edit configuration button", () => {
    render(<Servers />);
    expect(screen.getByText("EditConfiguration")).toBeInTheDocument();
  });

  it("renders available tools with withHeader=true by default (tab variant)", () => {
    render(<Servers />);
    const tools = screen.getByTestId("available-tools");
    expect(tools).toHaveAttribute("data-with-header", "true");
  });

  it("renders available tools with withHeader=false for page variant", () => {
    render(<Servers variant="page" />);
    const tools = screen.getByTestId("available-tools");
    expect(tools).toHaveAttribute("data-with-header", "false");
  });

  it("renders permissions header and ToolsCounter for page variant", () => {
    render(<Servers variant="page" />);
    expect(screen.getByText("Permissions")).toBeInTheDocument();
    expect(screen.getByTestId("tools-counter")).toBeInTheDocument();
  });

  it("does not render permissions header for tab variant", () => {
    render(<Servers />);
    expect(screen.queryByText("Permissions")).not.toBeInTheDocument();
  });

  it("opens the inline config editor when edit button is clicked", () => {
    render(<Servers />);
    const editor = screen.getByTestId("config-editor");
    expect(editor).toHaveAttribute("data-open", "false");

    fireEvent.click(screen.getByText("EditConfiguration"));
    expect(screen.getByTestId("config-editor")).toHaveAttribute(
      "data-open",
      "true"
    );
  });

  it("closes the inline config editor when onClose is called", () => {
    render(<Servers />);
    fireEvent.click(screen.getByText("EditConfiguration"));
    expect(screen.getByTestId("config-editor")).toHaveAttribute(
      "data-open",
      "true"
    );

    fireEvent.click(screen.getByTestId("config-editor"));
    expect(screen.getByTestId("config-editor")).toHaveAttribute(
      "data-open",
      "false"
    );
  });

  it("dims and disables the permissions block while the editor is open", () => {
    render(<Servers variant="page" />);
    const wrapper = screen.getByTestId("available-tools").parentElement!;
    expect(wrapper.className).not.toContain("opacity-40");
    expect(wrapper.className).not.toContain("pointer-events-none");

    fireEvent.click(screen.getByText("EditConfiguration"));

    expect(wrapper.className).toContain("opacity-40");
    expect(wrapper.className).toContain("pointer-events-none");
  });
});
