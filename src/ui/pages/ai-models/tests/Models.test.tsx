// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const profiles = [
  { id: "p1", name: "First" },
  { id: "p2", name: "Second" },
];

vi.mock("../../../providers/LocalesProvider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../providers/ComponentsProvider", () => ({
  useComponents: () => ({
    Button: ({
      children,
      onClick,
      className,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      className?: string;
    }) => (
      <button data-testid="add-btn" onClick={onClick} className={className}>
        {children}
      </button>
    ),
  }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useProfilesStore: () => ({ profiles }),
  }),
}));

vi.mock("../../../components/model-card", () => ({
  ModelCard: ({
    profile,
    isEditing,
    onStartEdit,
    onStopEdit,
  }: {
    profile: { id: string; name: string };
    isEditing: boolean;
    onStartEdit: () => void;
    onStopEdit: () => void;
  }) => (
    <div data-testid={`model-${profile.id}`} data-editing={isEditing}>
      <button data-testid={`edit-${profile.id}`} onClick={onStartEdit}>
        edit
      </button>
      <button data-testid={`close-${profile.id}`} onClick={onStopEdit}>
        close
      </button>
      {profile.name}
    </div>
  ),
}));

vi.mock("../../../components/model-config-cards", () => ({
  AddModelCard: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-card">
      <button data-testid="add-card-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

import { Models } from "../sub-components";

describe("Models", () => {
  it("renders add button and existing profiles", () => {
    render(<Models />);
    expect(screen.getByTestId("add-btn")).toHaveTextContent("AddModel");
    expect(screen.getByTestId("model-p1")).toBeInTheDocument();
    expect(screen.getByTestId("model-p2")).toBeInTheDocument();
  });

  it("opens AddModelCard when Add button is clicked", () => {
    render(<Models />);
    fireEvent.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("add-card")).toBeInTheDocument();
  });

  it("closes the Add card when onClose fires", () => {
    render(<Models />);
    fireEvent.click(screen.getByTestId("add-btn"));
    fireEvent.click(screen.getByTestId("add-card-close"));
    expect(screen.queryByTestId("add-card")).not.toBeInTheDocument();
  });

  it("marks a single profile as editing when its onStartEdit fires", () => {
    render(<Models />);
    fireEvent.click(screen.getByTestId("edit-p1"));
    expect(screen.getByTestId("model-p1").dataset.editing).toBe("true");
    expect(screen.getByTestId("model-p2").dataset.editing).toBe("false");
  });

  it("clears editing state via onStopEdit", () => {
    render(<Models />);
    fireEvent.click(screen.getByTestId("edit-p1"));
    fireEvent.click(screen.getByTestId("close-p1"));
    expect(screen.getByTestId("model-p1").dataset.editing).toBe("false");
  });
});
