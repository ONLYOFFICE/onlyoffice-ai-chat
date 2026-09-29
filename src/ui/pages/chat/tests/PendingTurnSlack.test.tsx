// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

type Message = { role: string; content?: unknown; status?: unknown };

const messageState = {
  messages: [] as Message[],
  isStreamRunning: false,
};

const viewportState = {
  turnAnchor: "top" as "top" | "bottom",
  height: { viewport: 600, inset: 40, userMessage: 0 },
};

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useMessageStore: (selector?: (s: typeof messageState) => unknown) =>
      selector ? selector(messageState) : messageState,
  }),
}));

vi.mock("@assistant-ui/react", () => ({
  useThreadViewport: (selector: (s: typeof viewportState) => unknown) =>
    selector(viewportState),
}));

import { PendingTurnSlack } from "../sub-components/PendingTurnSlack";

const spacer = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("div[aria-hidden='true']");

describe("PendingTurnSlack", () => {
  beforeEach(() => {
    messageState.messages = [];
    messageState.isStreamRunning = false;
    viewportState.turnAnchor = "top";
    viewportState.height = { viewport: 600, inset: 40, userMessage: 0 };
  });

  // The window this exists for: the question has been sent, the assistant
  // message that would carry the runtime's own slack does not exist yet.
  it("holds the scroll room while a question has no answer yet", () => {
    messageState.messages = [{ role: "user" }];
    messageState.isStreamRunning = true;

    const { container } = render(<PendingTurnSlack />);

    // viewport 600 - inset 40 - the 6em clamp offset at a 16px root.
    expect(spacer(container)).toHaveStyle({ height: "464px" });
  });

  it("yields to the runtime's slack once the answer starts", () => {
    messageState.messages = [
      { role: "user" },
      {
        role: "assistant",
        content: [{ type: "text", text: "Once upon a time" }],
        status: { type: "running" },
      },
    ];
    messageState.isStreamRunning = true;

    const { container } = render(<PendingTurnSlack />);

    expect(spacer(container)).toBeNull();
  });

  // An in-flight assistant message with nothing in it yet renders to
  // nothing — no `MessagePrimitive.Root`, so no runtime slack either. The
  // gap has to stay held until there is something on screen.
  it("keeps holding while the answer is still an empty placeholder", () => {
    messageState.messages = [
      { role: "user" },
      { role: "assistant", content: [], status: { type: "running" } },
    ];
    messageState.isStreamRunning = true;

    const { container } = render(<PendingTurnSlack />);

    expect(spacer(container)).toHaveStyle({ height: "464px" });
  });

  it("renders nothing when no run is in flight", () => {
    messageState.messages = [{ role: "user" }];
    messageState.isStreamRunning = false;

    const { container } = render(<PendingTurnSlack />);

    expect(spacer(container)).toBeNull();
  });

  // A host that opts into the classic follow gets the classic layout, where
  // nothing lifts the question off the composer.
  it("renders nothing when the turn is anchored at the bottom", () => {
    messageState.messages = [{ role: "user" }];
    messageState.isStreamRunning = true;
    viewportState.turnAnchor = "bottom";

    const { container } = render(<PendingTurnSlack />);

    expect(spacer(container)).toBeNull();
  });

  it("never asks for a negative height in a viewport smaller than the clamp", () => {
    messageState.messages = [{ role: "user" }];
    messageState.isStreamRunning = true;
    viewportState.height = { viewport: 50, inset: 40, userMessage: 0 };

    const { container } = render(<PendingTurnSlack />);

    expect(spacer(container)).toHaveStyle({ height: "0px" });
  });
});
