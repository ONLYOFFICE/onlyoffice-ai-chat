// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../components/icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

vi.mock("../../../../widget-config", () => ({
  useWidgetConfig: () => ({}),
}));

vi.mock("../../../store/context", () => {
  const attachmentsState = {
    attachmentFiles: [],
    attachmentImages: [],
    pendingAttachments: [],
    cancelPendingAttachment: () => undefined,
  };
  const messageState = { isStreamRunning: false };
  const profile = { id: "1", name: "GPT" };
  return {
    useStores: () => ({
      useAttachmentsStore: (
        selector: (s: typeof attachmentsState) => unknown
      ) => selector(attachmentsState),
      useProfilesStore: () => profile,
      useMessageStore: (selector: (s: typeof messageState) => unknown) =>
        selector(messageState),
      selectCurrentChatProfile: () => profile,
    }),
  };
});

vi.mock("@assistant-ui/react", () => ({
  ComposerPrimitive: {
    Root: ({ children, ...props }: { children: React.ReactNode }) => (
      <form {...props}>{children}</form>
    ),
    Input: (props: Record<string, unknown>) => (
      <textarea data-testid={props["data-testid"] as string} />
    ),
  },
  useComposerRuntime: () => ({ setText: vi.fn(), send: vi.fn() }),
}));

// The real ComboBox (and through it the real Radix menu) stands in for the
// action bar: the bug lives in how the composer's click-to-focus handler and
// the non-modal menu's focus-outside dismissal meet, which a mock would hide.
// The connected-room chip reads the clouds store, which this test's store
// mock does not carry; it is not what is under test here.
vi.mock("../sub-components/ComposerActionRoom", () => ({
  ComposerActionRoom: () => null,
}));

vi.mock("../sub-components/ComposerAction", async () => {
  const { ComboBox } = await import("../../../components/combo-box");
  return {
    ComposerAction: () => (
      <ComboBox
        data-testid="model-selector"
        value="GPT"
        items={[{ text: "Claude", onClick: () => undefined }]}
      />
    ),
  };
});

import { Composer } from "../sub-components/Composer";

describe("Composer model selector", () => {
  // Bug 84070: the click that opened the panel bubbled to the composer, which
  // did not recognise the trigger as a control and moved focus to the
  // textarea; the non-modal menu took that as focus leaving it and closed.
  it("keeps the model panel open after the click that opens it", async () => {
    const user = userEvent.setup();
    render(<Composer />);

    await user.click(screen.getByTestId("model-selector"));

    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByTestId("composer-input")).not.toHaveFocus();
  });
});
