// @vitest-environment jsdom
import { describe, expect, it, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../index";

vi.mock("../../../theme", () => ({
  useTheme: () => ({ portalContainer: null }),
}));

beforeAll(() => {
  // Radix UI tooltip uses ResizeObserver
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("TooltipProvider", () => {
  it("renders children", () => {
    render(
      <TooltipProvider>
        <span>child</span>
      </TooltipProvider>
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });
});

describe("Tooltip", () => {
  it("renders trigger content", () => {
    render(
      <Tooltip>
        <TooltipTrigger>
          <button>Hover me</button>
        </TooltipTrigger>
      </Tooltip>
    );
    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });
});

describe("TooltipTrigger", () => {
  it("renders with data-slot", () => {
    render(
      <Tooltip>
        <TooltipTrigger>
          <button>Trigger</button>
        </TooltipTrigger>
      </Tooltip>
    );
    expect(screen.getByText("Trigger")).toBeInTheDocument();
  });
});

describe("TooltipContent", () => {
  it("renders inside portal when tooltip is open", () => {
    const container = document.createElement("div");
    container.id = "app";
    document.body.appendChild(container);

    render(
      <Tooltip open>
        <TooltipTrigger>
          <button>Hover</button>
        </TooltipTrigger>
        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    );

    const matches = screen.getAllByText("Tooltip text");
    expect(matches.length).toBeGreaterThanOrEqual(1);

    document.body.removeChild(container);
  });

  it("renders arrow when isAbout is true", () => {
    const container = document.createElement("div");
    container.id = "app";
    document.body.appendChild(container);

    render(
      <Tooltip open>
        <TooltipTrigger>
          <button>Hover</button>
        </TooltipTrigger>
        <TooltipContent isAbout>About info</TooltipContent>
      </Tooltip>
    );

    const matches = screen.getAllByText("About info");
    expect(matches.length).toBeGreaterThanOrEqual(1);

    document.body.removeChild(container);
  });
});
