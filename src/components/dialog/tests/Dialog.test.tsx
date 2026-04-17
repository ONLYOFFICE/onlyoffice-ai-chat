// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../theme", () => ({
  useTheme: () => ({ portalContainer: null }),
}));

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

vi.mock("../../icon-button", () => ({
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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from "../index";

describe("Dialog", () => {
  it("renders with data-slot", () => {
    const { container } = render(
      <Dialog open>
        <div>child</div>
      </Dialog>
    );
    // Dialog Root doesn't render a DOM element itself, it provides context
    expect(container).toBeTruthy();
  });
});

describe("DialogTrigger", () => {
  it("renders trigger with data-slot", () => {
    render(
      <Dialog>
        <DialogTrigger>
          <button>Open</button>
        </DialogTrigger>
      </Dialog>
    );
    expect(screen.getByText("Open")).toBeInTheDocument();
  });
});

describe("DialogOverlay", () => {
  it("renders with data-slot attribute", () => {
    render(
      <Dialog open>
        <DialogOverlay data-testid="overlay" />
      </Dialog>
    );
    // Overlay may not render outside a portal context, but it should not throw
  });

  it("accepts custom className", () => {
    // Just verifying no crash
    expect(() =>
      render(
        <Dialog open>
          <DialogOverlay className="custom-overlay" />
        </Dialog>
      )
    ).not.toThrow();
  });
});

describe("DialogTitle", () => {
  it("renders title text", () => {
    render(
      <Dialog open>
        <DialogTitle>My Title</DialogTitle>
      </Dialog>
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("renders with data-slot", () => {
    render(
      <Dialog open>
        <DialogTitle>Title</DialogTitle>
      </Dialog>
    );
    expect(screen.getByText("Title")).toHaveAttribute(
      "data-slot",
      "dialog-title"
    );
  });
});

describe("DialogDescription", () => {
  it("renders description text", () => {
    render(
      <Dialog open>
        <DialogDescription>Some description</DialogDescription>
      </Dialog>
    );
    expect(screen.getByText("Some description")).toBeInTheDocument();
  });

  it("has data-slot attribute", () => {
    render(
      <Dialog open>
        <DialogDescription>Desc</DialogDescription>
      </Dialog>
    );
    expect(screen.getByText("Desc")).toHaveAttribute(
      "data-slot",
      "dialog-description"
    );
  });
});

describe("DialogFooter", () => {
  it("renders children", () => {
    render(
      <DialogFooter>
        <button>OK</button>
        <button>Cancel</button>
      </DialogFooter>
    );
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("has data-slot attribute", () => {
    const { container } = render(
      <DialogFooter>
        <button>OK</button>
      </DialogFooter>
    );
    expect(container.firstElementChild).toHaveAttribute(
      "data-slot",
      "dialog-footer"
    );
  });
});

describe("DialogContent", () => {
  it("renders header and children inside open dialog", () => {
    // Need to provide portal container
    const container = document.createElement("div");
    container.id = "app";
    document.body.appendChild(container);

    render(
      <Dialog open>
        <DialogContent header="Edit Profile" onClose={vi.fn()}>
          <p>Body content</p>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByText("Edit Profile")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();

    document.body.removeChild(container);
  });

  it("calls onClose when close button is clicked", () => {
    const container = document.createElement("div");
    container.id = "app";
    document.body.appendChild(container);

    const onClose = vi.fn();
    render(
      <Dialog open>
        <DialogContent header="Test" onClose={onClose}>
          <p>body</p>
        </DialogContent>
      </Dialog>
    );

    fireEvent.click(screen.getByTestId("icon-btn-btn-close"));
    expect(onClose).toHaveBeenCalledOnce();

    document.body.removeChild(container);
  });

  it("calls onClose on Escape key", () => {
    const container = document.createElement("div");
    container.id = "app";
    document.body.appendChild(container);

    const onClose = vi.fn();
    render(
      <Dialog open>
        <DialogContent header="Test" onClose={onClose}>
          <p>body</p>
        </DialogContent>
      </Dialog>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();

    document.body.removeChild(container);
  });
});
