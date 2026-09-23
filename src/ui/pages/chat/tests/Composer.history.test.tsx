// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ThreadMessageLike } from "@assistant-ui/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockSetText = vi.fn();
const mockSend = vi.fn();

vi.mock("@assistant-ui/react", () => ({
  ComposerPrimitive: {
    Root: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      onSubmit?: (e: React.FormEvent) => void;
    }) => (
      <form data-testid="composer-root" {...props}>
        {children}
      </form>
    ),
    // A real <textarea> so `selectionStart`/`selectionEnd` behave — the
    // whole point of these tests is the caret-position rule.
    Input: (props: Record<string, unknown>) => (
      <textarea
        data-testid={props["data-testid"] as string}
        placeholder={props.placeholder as string}
        disabled={props.disabled as boolean}
        onKeyDown={
          props.onKeyDown as (
            e: React.KeyboardEvent<HTMLTextAreaElement>
          ) => void
        }
      />
    ),
  },
  useComposerRuntime: () => ({ setText: mockSetText, send: mockSend }),
}));

vi.mock("../sub-components/ComposerAction", () => ({
  ComposerAction: () => <div data-testid="composer-action" />,
}));

vi.mock("../../../components/file-item", () => ({
  FileItem: () => <div data-testid="file-item" />,
}));

vi.mock("../../../components/file-item/PendingFileItem", () => ({
  PendingFileItem: () => <div data-testid="pending-file-item" />,
}));

const mockUseStores = vi.fn();
vi.mock("../../../store/context", () => ({
  useStores: () => mockUseStores(),
}));

const mockUseWidgetConfig = vi.fn();
vi.mock("../../../../widget-config", () => ({
  useWidgetConfig: () => mockUseWidgetConfig(),
}));

vi.mock("../../../providers/ImperativeProvider", () => ({
  useComposerBridge: () => null,
}));

import { Composer } from "../sub-components/Composer";

const user = (text: string): ThreadMessageLike => ({
  role: "user",
  content: [{ type: "text", text }],
});

const assistant = (text: string): ThreadMessageLike => ({
  role: "assistant",
  content: [{ type: "text", text }],
});

/** A thread of alternating prompts and replies, oldest first. */
const thread = (...prompts: string[]): ThreadMessageLike[] =>
  prompts.flatMap((p) => [user(p), assistant(`re: ${p}`)]);

type MessageState = {
  isStreamRunning: boolean;
  messages: ThreadMessageLike[];
  hasMoreOlderMessages: boolean;
  loadOlderMessages: () => Promise<void>;
};

let messageState: MessageState;

function setup(messages: ThreadMessageLike[] = []) {
  const attachmentsState = {
    attachmentFiles: [],
    attachmentImages: [],
    pendingAttachments: [],
    cancelPendingAttachment: vi.fn(),
  };
  messageState = {
    isStreamRunning: false,
    messages,
    hasMoreOlderMessages: false,
    loadOlderMessages: () => Promise.resolve(),
  };
  mockUseStores.mockReturnValue({
    useAttachmentsStore: (
      selector?: (s: typeof attachmentsState) => unknown
    ) =>
      typeof selector === "function"
        ? selector(attachmentsState)
        : attachmentsState,
    useProfilesStore: (selector?: unknown) =>
      typeof selector === "function" ? { id: "1", name: "GPT" } : {},
    useMessageStore: Object.assign(
      (selector?: (s: MessageState) => unknown) =>
        typeof selector === "function" ? selector(messageState) : messageState,
      { getState: () => messageState }
    ),
    selectCurrentChatProfile: () => ({ id: "1", name: "GPT" }),
  });
  mockUseWidgetConfig.mockReturnValue({});
}

function renderComposer(messages: ThreadMessageLike[] = []) {
  setup(messages);
  render(<Composer />);
  return screen.getByTestId("composer-input") as HTMLTextAreaElement;
}

/** Put text in the box and park the caret at an explicit offset. */
function setValue(
  input: HTMLTextAreaElement,
  value: string,
  caret = value.length
) {
  input.value = value;
  input.selectionStart = input.selectionEnd = caret;
}

/** The recall is async — the step may have to fetch an older page. */
const expectRecalled = (text: string) =>
  waitFor(() => expect(mockSetText).toHaveBeenLastCalledWith(text));

/**
 * Assert the arrow was left to the textarea. Nothing to wait for, so give
 * the (possibly pending) step a chance to resolve before checking.
 */
async function expectNotRecalled() {
  await Promise.resolve();
  await Promise.resolve();
  expect(mockSetText).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Composer history navigation", () => {
  it("recalls the previous prompt on ArrowUp in an empty input", async () => {
    const input = renderComposer(thread("older", "newest"));
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("newest");
  });

  it("walks further back on repeated ArrowUp", async () => {
    const input = renderComposer(thread("older", "newest"));
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("newest");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("older");
  });

  it("walks forward again on ArrowDown", async () => {
    const input = renderComposer(thread("older", "newest"));
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("newest");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("older");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await expectRecalled("newest");
  });

  it("recalls on ArrowUp when the caret sits at the very start of a draft", async () => {
    const input = renderComposer(thread("recalled"));
    setValue(input, "line one\nline two", 0);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("recalled");
  });

  it("leaves ArrowUp to the textarea when the caret is mid-text", async () => {
    const input = renderComposer(thread("recalled"));
    setValue(input, "line one\nline two", 12);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectNotRecalled();
  });

  it("leaves ArrowDown to the textarea when the caret is not at the end", async () => {
    const input = renderComposer(thread("recalled"));
    setValue(input, "line one\nline two", 0);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await expectNotRecalled();
  });

  it("leaves the arrow alone when text is selected", async () => {
    const input = renderComposer(thread("recalled"));
    input.value = "some text";
    input.selectionStart = 0;
    input.selectionEnd = 4;
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectNotRecalled();
  });

  it("does nothing on ArrowUp in a thread with no prompts", async () => {
    const input = renderComposer([]);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectNotRecalled();
  });

  it("restores the typed draft when walking back past the newest entry", async () => {
    const input = renderComposer(thread("sent"));
    setValue(input, "my draft", 0);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("sent");
    // Walking forward again needs the caret at the end, so put it there the
    // way an ArrowDown-then-ArrowUp round trip would.
    setValue(input, "sent");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await expectRecalled("my draft");
  });

  it("abandons the walk once the user edits the recalled text", async () => {
    const input = renderComposer(thread("older", "newest"));
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("newest");
    // Typing a character makes it the user's own draft again.
    setValue(input, "newest!");
    fireEvent.keyDown(input, { key: "!" });
    // So the next Up starts over from the newest entry, not from "older".
    setValue(input, "newest!", 0);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("newest");
  });

  it("recalls a just-sent prompt with no recording step", async () => {
    const input = renderComposer([]);
    // A send appends the user message to the store — nothing else is
    // needed to make it the newest history entry.
    messageState.messages = [user("a prompt")];
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("a prompt");
  });

  it("pulls an older page when the walk runs off the top of the window", async () => {
    const input = renderComposer(thread("newest"));
    messageState.hasMoreOlderMessages = true;
    messageState.loadOlderMessages = vi.fn(() => {
      messageState.messages = [
        ...thread("from an older page"),
        ...messageState.messages,
      ];
      messageState.hasMoreOlderMessages = false;
      return Promise.resolve();
    });

    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("newest");
    setValue(input, "newest", 0);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("from an older page");
    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("keeps pulling past a page that holds no prompts of its own", async () => {
    const input = renderComposer(thread("newest"));
    messageState.hasMoreOlderMessages = true;
    // The page immediately older is one long assistant turn — real
    // prompts are only on the page behind it.
    const pages = [
      [assistant("a long answer"), assistant("still answering")],
      thread("from two pages back"),
    ];
    messageState.loadOlderMessages = vi.fn(() => {
      const page = pages.shift() ?? [];
      messageState.messages = [...page, ...messageState.messages];
      messageState.hasMoreOlderMessages = pages.length > 0;
      return Promise.resolve();
    });

    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("newest");
    setValue(input, "newest", 0);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("from two pages back");
    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("stops when a page load brings no messages at all", async () => {
    const input = renderComposer(thread("newest"));
    messageState.hasMoreOlderMessages = true;
    // A failed load leaves the window as it was but keeps the flag on.
    messageState.loadOlderMessages = vi.fn(() => Promise.resolve());

    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("newest");
    mockSetText.mockClear();
    setValue(input, "newest", 0);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectNotRecalled();
    expect(messageState.loadOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite a fresh draft typed while an older page is loading", async () => {
    const input = renderComposer(thread("newest"));
    messageState.hasMoreOlderMessages = true;
    let releasePage: () => void = () => {};
    messageState.loadOlderMessages = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releasePage = () => {
            messageState.messages = [
              ...thread("from an older page"),
              ...messageState.messages,
            ];
            messageState.hasMoreOlderMessages = false;
            resolve();
          };
        })
    );

    fireEvent.keyDown(input, { key: "ArrowUp" });
    await expectRecalled("newest");
    setValue(input, "newest", 0);
    // Second Up suspends on the page fetch...
    fireEvent.keyDown(input, { key: "ArrowUp" });
    mockSetText.mockClear();
    // ...and the user starts a new draft before it comes back.
    setValue(input, "a fresh draft");
    fireEvent.keyDown(input, { key: "d" });
    releasePage();

    await expectNotRecalled();
  });

  it("does not overwrite a fresh draft typed during the walk's very first step", async () => {
    // Nothing walkable in the loaded window, so the first Up suspends on
    // a page fetch straight away — the interruption then leaves the depth
    // at 0, exactly where the step read it.
    const input = renderComposer([assistant("only a reply here")]);
    messageState.hasMoreOlderMessages = true;
    let releasePage: () => void = () => {};
    messageState.loadOlderMessages = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releasePage = () => {
            messageState.messages = [
              ...thread("from an older page"),
              ...messageState.messages,
            ];
            messageState.hasMoreOlderMessages = false;
            resolve();
          };
        })
    );

    fireEvent.keyDown(input, { key: "ArrowUp" });
    setValue(input, "a fresh draft");
    fireEvent.keyDown(input, { key: "d" });
    releasePage();

    await expectNotRecalled();
  });

  describe("caret placement after a recall", () => {
    /**
     * The composer runtime is mocked, so the recalled text never reaches the
     * textarea on its own. Mirror what the real `setText` does — write the
     * value — so the post-paint caret placement has something to measure
     * against, then flush the frame it defers to.
     */
    function recallInto(input: HTMLTextAreaElement, key: string) {
      mockSetText.mockImplementation((text: string) => {
        input.value = text;
      });
      fireEvent.keyDown(input, { key });
      return waitFor(() => {
        expect(mockSetText).toHaveBeenCalled();
      }).then(
        () => new Promise((resolve) => requestAnimationFrame(() => resolve(0)))
      );
    }

    it("parks the caret at the start after ArrowUp, so the next Up walks on", async () => {
      const input = renderComposer(thread("line one\nline two"));
      await recallInto(input, "ArrowUp");
      expect(input.value).toBe("line one\nline two");
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(0);
    });

    it("parks the caret at the end after ArrowDown, so the next Down walks on", async () => {
      const input = renderComposer(thread("older", "line one\nline two"));
      // Walk back twice to leave room to walk forward again.
      await recallInto(input, "ArrowUp");
      await recallInto(input, "ArrowUp");
      setValue(input, "older");
      await recallInto(input, "ArrowDown");
      expect(input.value).toBe("line one\nline two");
      expect(input.selectionStart).toBe(input.value.length);
      expect(input.selectionEnd).toBe(input.value.length);
    });

    it("keeps walking back on a second ArrowUp without repositioning the caret", async () => {
      const input = renderComposer(thread("older", "newest"));
      await recallInto(input, "ArrowUp");
      expect(input.value).toBe("newest");
      // No manual caret fix-up here: the recall already left it at the
      // start, so this Up is claimed by history rather than the textarea.
      await recallInto(input, "ArrowUp");
      expect(input.value).toBe("older");
    });
  });
});
