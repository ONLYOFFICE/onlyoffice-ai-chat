// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockSetText = vi.fn();
const mockSend = vi.fn();
let composerText = "";

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
  useComposerRuntime: () => ({
    setText: mockSetText,
    send: mockSend,
    getState: () => ({ text: composerText }),
  }),
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

const mockHistoryList = vi.fn();
const mockHistoryRecord = vi.fn();

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
import { __resetPromptHistoryCache } from "../../../hooks/usePromptHistory";

function setup(history: string[] = []) {
  mockHistoryList.mockResolvedValue(history);
  const attachmentsState = {
    attachmentFiles: [],
    attachmentImages: [],
    pendingAttachments: [],
    cancelPendingAttachment: vi.fn(),
  };
  const messageState = { isStreamRunning: false, messages: [] };
  const threadsState = { threadId: "thread-1" };
  const useThreadsStore = Object.assign(
    (selector?: (s: typeof threadsState) => unknown) =>
      typeof selector === "function" ? selector(threadsState) : threadsState,
    { subscribe: () => () => {} }
  );
  mockUseStores.mockReturnValue({
    useThreadsStore,
    useAttachmentsStore: (
      selector?: (s: typeof attachmentsState) => unknown
    ) =>
      typeof selector === "function"
        ? selector(attachmentsState)
        : attachmentsState,
    useProfilesStore: (selector?: unknown) =>
      typeof selector === "function" ? { id: "1", name: "GPT" } : {},
    useMessageStore: Object.assign(
      (selector?: (s: typeof messageState) => unknown) =>
        typeof selector === "function" ? selector(messageState) : messageState,
      { getState: () => messageState }
    ),
    selectCurrentChatProfile: () => ({ id: "1", name: "GPT" }),
    api: {
      promptHistory: {
        list: mockHistoryList,
        record: mockHistoryRecord,
        clear: vi.fn(),
      },
    },
  });
  mockUseWidgetConfig.mockReturnValue({});
}

/** Render, then wait out the hook's initial async history load. */
async function renderComposer(history: string[] = []) {
  setup(history);
  render(<Composer />);
  const input = screen.getByTestId("composer-input") as HTMLTextAreaElement;
  // Flush the `list()` promise so the history ref is populated.
  await vi.waitFor(() => expect(mockHistoryList).toHaveBeenCalled());
  await Promise.resolve();
  await Promise.resolve();
  return input;
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

beforeEach(() => {
  vi.clearAllMocks();
  composerText = "";
  // The history cache is module state shared by every hook instance, so
  // one case's prompts would otherwise seed the next.
  __resetPromptHistoryCache();
});

describe("Composer history navigation", () => {
  it("recalls the previous prompt on ArrowUp in an empty input", async () => {
    const input = await renderComposer(["older", "newest"]);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockSetText).toHaveBeenCalledWith("newest");
  });

  it("walks further back on repeated ArrowUp", async () => {
    const input = await renderComposer(["older", "newest"]);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockSetText).toHaveBeenLastCalledWith("older");
  });

  it("walks forward again on ArrowDown", async () => {
    const input = await renderComposer(["older", "newest"]);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(mockSetText).toHaveBeenLastCalledWith("newest");
  });

  it("recalls on ArrowUp when the caret sits at the very start of a draft", async () => {
    const input = await renderComposer(["recalled"]);
    setValue(input, "line one\nline two", 0);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockSetText).toHaveBeenCalledWith("recalled");
  });

  it("leaves ArrowUp to the textarea when the caret is mid-text", async () => {
    const input = await renderComposer(["recalled"]);
    setValue(input, "line one\nline two", 12);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockSetText).not.toHaveBeenCalled();
  });

  it("leaves ArrowDown to the textarea when the caret is not at the end", async () => {
    const input = await renderComposer(["recalled"]);
    setValue(input, "line one\nline two", 0);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(mockSetText).not.toHaveBeenCalled();
  });

  it("leaves the arrow alone when text is selected", async () => {
    const input = await renderComposer(["recalled"]);
    input.value = "some text";
    input.selectionStart = 0;
    input.selectionEnd = 4;
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockSetText).not.toHaveBeenCalled();
  });

  it("does nothing on ArrowUp when there is no history", async () => {
    const input = await renderComposer([]);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockSetText).not.toHaveBeenCalled();
  });

  it("restores the typed draft when walking back past the newest entry", async () => {
    const input = await renderComposer(["sent"]);
    setValue(input, "my draft", 0);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockSetText).toHaveBeenLastCalledWith("sent");
    // The recalled text is now in the box, caret at the end.
    setValue(input, "sent");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(mockSetText).toHaveBeenLastCalledWith("my draft");
  });

  it("abandons the walk once the user edits the recalled text", async () => {
    const input = await renderComposer(["older", "newest"]);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockSetText).toHaveBeenLastCalledWith("newest");
    // Typing a character makes it the user's own draft again.
    setValue(input, "newest!");
    fireEvent.keyDown(input, { key: "!" });
    // So the next Up starts over from the newest entry, not from "older".
    setValue(input, "newest!", 0);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockSetText).toHaveBeenLastCalledWith("newest");
  });

  it("records the sent prompt on submit", async () => {
    await renderComposer([]);
    composerText = "a prompt";
    fireEvent.submit(screen.getByTestId("composer-root"));
    expect(mockHistoryRecord).toHaveBeenCalledWith("a prompt", "thread-1");
  });

  it("makes a just-sent prompt available to ArrowUp", async () => {
    const input = await renderComposer([]);
    composerText = "a prompt";
    fireEvent.submit(screen.getByTestId("composer-root"));
    composerText = "";
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(mockSetText).toHaveBeenLastCalledWith("a prompt");
  });
});
