// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockSetSessionChatProfile = vi.fn();
const mockSetReasoningLevel = vi.fn();
let mockReasoningLevel = "off";
// Off by default so the existing item counts hold; the effort describe
// switches it on.
let mockReasoningSupport: {
  thinks: boolean;
  canDisable: boolean;
  depths: string[];
} = { thinks: false, canDisable: false, depths: [] };

vi.mock("../../../hooks/useReasoningSupport", () => ({
  useReasoningSupport: () => mockReasoningSupport,
}));
const mockSetCurrentProviderTools = vi.fn();
const mockSetCurrentProviderPrevMessages = vi.fn();
const mockUseStores = vi.fn();

vi.mock("../../../store/context", () => ({
  useStores: () => mockUseStores(),
}));

let lastComboBoxProps: Record<string, unknown> = {};

vi.mock("../../../components/combo-box", () => ({
  ComboBox: (props: Record<string, unknown>) => {
    lastComboBoxProps = props;
    return (
      <div
        data-testid="combo-box"
        data-placeholder={props.placeholder}
        data-value={props.value}
        data-item-count={(props.items as unknown[])?.length ?? 0}
      />
    );
  },
}));

vi.mock("../../../../capabilities", () => ({
  CapabilitiesUI: {
    None: 0x00,
    Chat: 0x01,
    Image: 0x02,
    Embeddings: 0x04,
  },
}));

import { SelectModel } from "../sub-components/ComposerActionSelectModel";
import { WidgetConfigProvider } from "../../../../widget-config";
import type { ProfilePickerAction } from "../profile-picker-actions";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";

function setupStores(overrides?: {
  profiles?: { id: string; name: string; capabilities?: number }[];
  currentProfile?: { id: string; name: string } | null;
}) {
  const profiles = overrides?.profiles ?? [];
  const currentProfile = overrides?.currentProfile ?? null;

  const profilesState = {
    profiles,
    setSessionChatProfile: mockSetSessionChatProfile,
    getProfileById: (id: string) => profiles.find((p) => p.id === id) ?? null,
    sessionChatProfile: currentProfile,
    chatProfile: null,
    defaultProfile: null,
    reasoningLevel: mockReasoningLevel,
    setReasoningLevel: mockSetReasoningLevel,
  };
  const selectCurrentChatProfile = (s: typeof profilesState) =>
    s.sessionChatProfile ?? s.chatProfile ?? s.defaultProfile;
  mockUseStores.mockReturnValue({
    useProfilesStore: (selector?: (s: typeof profilesState) => unknown) => {
      if (typeof selector === "function") return selector(profilesState);
      return profilesState;
    },
    useServersStore: () => ({
      tools: [],
    }),
    useMessageStore: () => ({
      messages: [],
    }),
    selectCurrentChatProfile,
    provider: {
      setCurrentProviderTools: mockSetCurrentProviderTools,
      setCurrentProviderPrevMessages: mockSetCurrentProviderPrevMessages,
    },
  });
}

describe("SelectModel", () => {
  it("renders the combobox", () => {
    setupStores({ profiles: [], currentProfile: null });
    render(<SelectModel />);
    expect(screen.getByTestId("combo-box")).toBeInTheDocument();
  });

  it("displays placeholder when no profile selected", () => {
    setupStores({ profiles: [], currentProfile: null });
    render(<SelectModel />);
    const box = screen.getByTestId("combo-box");
    expect(box.getAttribute("data-placeholder")).toBe("SelectModel");
    expect(box.getAttribute("data-value")).toBe("");
  });

  it("displays current profile name as value", () => {
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: { id: "1", name: "GPT-4" },
    });
    render(<SelectModel />);
    const box = screen.getByTestId("combo-box");
    expect(box.getAttribute("data-value")).toBe("GPT-4");
  });

  it("filters out non-chat profiles", () => {
    setupStores({
      profiles: [
        { id: "1", name: "Chat Model", capabilities: 0x01 },
        { id: "2", name: "Image Model", capabilities: 0x02 },
        { id: "3", name: "No Cap Model" },
      ],
      currentProfile: null,
    });
    render(<SelectModel />);
    const box = screen.getByTestId("combo-box");
    // Chat Model (0x01 & 0x01 !== 0) + No Cap Model (no capabilities) = 2
    expect(box.getAttribute("data-item-count")).toBe("2");
  });

  it("includes profiles with combined capabilities that include Chat", () => {
    setupStores({
      profiles: [{ id: "1", name: "Multi Model", capabilities: 0x01 | 0x02 }],
      currentProfile: null,
    });
    render(<SelectModel />);
    const box = screen.getByTestId("combo-box");
    expect(box.getAttribute("data-item-count")).toBe("1");
  });
});

describe("SelectModel profilePickerReadOnly", () => {
  beforeEach(() => {
    mockSetSessionChatProfile.mockClear();
  });

  const renderReadOnly = () =>
    render(
      <WidgetConfigProvider config={{ profilePickerReadOnly: true }}>
        <SelectModel />
      </WidgetConfigProvider>
    );

  it("renders the profile name as static text instead of the combobox", () => {
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: { id: "1", name: "GPT-4" },
    });
    renderReadOnly();
    const label = screen.getByTestId("model-selector-readonly");
    expect(label.textContent).toBe("GPT-4");
    expect(screen.queryByTestId("combo-box")).not.toBeInTheDocument();
  });

  it("uses the secondary text color and the combobox text metrics", () => {
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: { id: "1", name: "GPT-4" },
    });
    renderReadOnly();
    const label = screen.getByTestId("model-selector-readonly");
    expect(label.className).toContain("text-[var(--text-secondary)]");
    expect(label.className).toContain("leading-[var(--lh-16)]");
    expect(label.className).toContain("truncate");
  });

  it("renders nothing when no profile is selected", () => {
    setupStores({ profiles: [], currentProfile: null });
    const { container } = renderReadOnly();
    expect(container).toBeEmptyDOMElement();
  });

  it("still auto-selects the first chat profile", () => {
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: null,
    });
    renderReadOnly();
    expect(mockSetSessionChatProfile).toHaveBeenCalledWith(
      { id: "1", name: "GPT-4" },
      undefined
    );
  });
});

describe("SelectModel profilePickerActions", () => {
  beforeEach(() => {
    mockSetSessionChatProfile.mockClear();
  });

  const renderWithActions = (actions: ProfilePickerAction[]) => {
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: { id: "1", name: "GPT-4" },
    });
    render(
      <WidgetConfigProvider config={{ profilePickerActions: actions }}>
        <SelectModel />
      </WidgetConfigProvider>
    );
    return lastComboBoxProps.items as DropDownItemProps[];
  };

  it("appends a separator and host items after the profiles", () => {
    const items = renderWithActions([
      { id: "manage", text: "Manage models", onClick: () => {} },
    ]);
    expect(items).toHaveLength(3);
    expect(items[0].text).toBe("GPT-4");
    expect(items[1].isSeparator).toBe(true);
    expect(items[2].text).toBe("Manage models");
  });

  it("renders no separator without actions", () => {
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: { id: "1", name: "GPT-4" },
    });
    render(
      <WidgetConfigProvider config={{}}>
        <SelectModel />
      </WidgetConfigProvider>
    );
    const items = lastComboBoxProps.items as DropDownItemProps[];
    expect(items).toHaveLength(1);
    expect(items.some((i) => i.isSeparator)).toBe(false);
  });

  it("maps nested items to subMenu and suppresses the row's onClick", () => {
    const rowClick = vi.fn();
    const childClick = vi.fn();
    const items = renderWithActions([
      {
        id: "agents",
        text: "Agents",
        onClick: rowClick,
        items: [{ id: "a1", text: "Agent One", onClick: childClick }],
      },
    ]);
    const row = items[2];
    expect(row.subMenu).toHaveLength(1);
    expect(row.subMenu?.[0].text).toBe("Agent One");

    row.onClick(new Event("click"));
    expect(rowClick).not.toHaveBeenCalled();

    row.subMenu?.[0].onClick(new Event("click"));
    expect(childClick).toHaveBeenCalledTimes(1);
  });

  it("fires onClick for a plain action row", () => {
    const onClick = vi.fn();
    const items = renderWithActions([
      { id: "manage", text: "Manage models", onClick },
    ]);
    items[2].onClick(new Event("click"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("selects the aliased profile with the action's text as name", () => {
    const items = renderWithActions([
      {
        id: "agents",
        text: "Agents",
        items: [{ id: "a1", text: "Agent One", profileId: "1" }],
      },
    ]);
    items[2].subMenu?.[0].onClick(new Event("click"));
    expect(mockSetSessionChatProfile).toHaveBeenCalledWith({
      id: "1",
      name: "Agent One",
    });
  });

  it("does nothing when profileId matches no profile", () => {
    const items = renderWithActions([
      { id: "a-gone", text: "Gone Agent", profileId: "missing" },
    ]);
    items[2].onClick(new Event("click"));
    expect(mockSetSessionChatProfile).not.toHaveBeenCalled();
  });

  it("marks the alias row checked and the profile row unchecked", () => {
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: { id: "1", name: "Agent One" },
    });
    render(
      <WidgetConfigProvider
        config={{
          profilePickerActions: [
            { id: "a1", text: "Agent One", profileId: "1" },
          ],
        }}
      >
        <SelectModel />
      </WidgetConfigProvider>
    );
    const items = lastComboBoxProps.items as DropDownItemProps[];
    expect(items[0].checked).toBe(false);
    expect(items[2].checked).toBe(true);
    expect(lastComboBoxProps.value).toBe("Agent One");
  });

  it("notifies the host on explicit picks, with actionId for actions", () => {
    const onProfilePickerSelect = vi.fn();
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: { id: "1", name: "GPT-4" },
    });
    render(
      <WidgetConfigProvider
        config={{
          onProfilePickerSelect,
          profilePickerActions: [
            { id: "a1", text: "Agent One", profileId: "1" },
          ],
        }}
      >
        <SelectModel />
      </WidgetConfigProvider>
    );
    const items = lastComboBoxProps.items as DropDownItemProps[];

    items[2].onClick(new Event("click"));
    expect(onProfilePickerSelect).toHaveBeenLastCalledWith(
      { id: "1", name: "Agent One" },
      "a1"
    );

    items[0].onClick(new Event("click"));
    expect(onProfilePickerSelect).toHaveBeenLastCalledWith({
      id: "1",
      name: "GPT-4",
    });
  });

  it("does not notify the host on the initial auto-select", () => {
    const onProfilePickerSelect = vi.fn();
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: null,
    });
    render(
      <WidgetConfigProvider config={{ onProfilePickerSelect }}>
        <SelectModel />
      </WidgetConfigProvider>
    );
    expect(mockSetSessionChatProfile).toHaveBeenCalled();
    expect(onProfilePickerSelect).not.toHaveBeenCalled();
  });

  it("re-picking the plain profile row restores its own name", () => {
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: { id: "1", name: "Agent One" },
    });
    render(
      <WidgetConfigProvider config={{}}>
        <SelectModel />
      </WidgetConfigProvider>
    );
    const items = lastComboBoxProps.items as DropDownItemProps[];
    items[0].onClick(new Event("click"));
    expect(mockSetSessionChatProfile).toHaveBeenCalledWith(
      { id: "1", name: "GPT-4" },
      { persistAssignment: true }
    );
  });

  it("opts into persisting the Chat assignment on an explicit profile pick", () => {
    setupStores({
      profiles: [
        { id: "1", name: "GPT-4" },
        { id: "2", name: "Claude" },
      ],
      currentProfile: { id: "1", name: "GPT-4" },
    });
    render(
      <WidgetConfigProvider config={{}}>
        <SelectModel />
      </WidgetConfigProvider>
    );
    const items = lastComboBoxProps.items as DropDownItemProps[];
    items[1].onClick(new Event("click"));
    expect(mockSetSessionChatProfile).toHaveBeenCalledWith(
      { id: "2", name: "Claude" },
      { persistAssignment: true }
    );
  });

  it("does not opt into persisting on the initial auto-select", () => {
    setupStores({
      profiles: [{ id: "1", name: "GPT-4" }],
      currentProfile: null,
    });
    render(
      <WidgetConfigProvider config={{}}>
        <SelectModel />
      </WidgetConfigProvider>
    );
    expect(mockSetSessionChatProfile).toHaveBeenCalledWith(
      { id: "1", name: "GPT-4" },
      undefined
    );
  });
});

describe("SelectModel effort row", () => {
  const items = () => lastComboBoxProps.items as DropDownItemProps[];
  const footer = () => lastComboBoxProps.footerItems as DropDownItemProps[];
  const effortRow = () => footer().find((i) => i.text === "Effort");

  beforeEach(() => {
    mockSetReasoningLevel.mockClear();
    mockReasoningLevel = "medium";
    mockReasoningSupport = {
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
    };
    setupStores({
      profiles: [
        { id: "p1", name: "GPT", capabilities: 0x01 },
        { id: "p2", name: "Claude", capabilities: 0x01 },
      ],
      currentProfile: { id: "p1", name: "GPT" },
    });
  });

  afterEach(() => {
    mockReasoningLevel = "off";
    mockReasoningSupport = { thinks: false, canDisable: false, depths: [] };
  });

  it("pins Effort under its own separator below the profile list", () => {
    render(<SelectModel />);
    // Only the profiles scroll; Effort is a footer row and stays in view.
    expect(items().map((i) => i.text)).toEqual(["GPT", "Claude"]);
    expect(footer().map((i) => i.text)).toEqual(["", "Effort"]);
    expect(footer()[0].isSeparator).toBe(true);
    expect(effortRow()?.trailingText).toBe("ThinkingLevelMedium");
    expect(effortRow()?.subMenu?.map((i) => i.text)).toEqual([
      "NoThinking",
      "ThinkingLevelLow",
      "ThinkingLevelMedium",
      "ThinkingLevelHigh",
      "ThinkingLevelMax",
    ]);
  });

  it("stays pinned below the host actions too", () => {
    const actions: ProfilePickerAction[] = [
      { id: "a1", text: "Agent A" },
      { id: "a2", text: "Agent B" },
    ];
    render(
      <WidgetConfigProvider config={{ profilePickerActions: actions }}>
        <SelectModel />
      </WidgetConfigProvider>
    );
    expect(items().map((i) => i.text)).toEqual([
      "GPT",
      "Claude",
      "",
      "Agent A",
      "Agent B",
    ]);
    expect(footer().map((i) => i.text)).toEqual(["", "Effort"]);
  });

  it("sets the picked level", () => {
    render(<SelectModel />);
    effortRow()!.subMenu![3].onClick(new Event("click"));
    expect(mockSetReasoningLevel).toHaveBeenCalledWith("high");
  });

  it("has no footer at all for a model that cannot think", () => {
    mockReasoningSupport = { thinks: false, canDisable: false, depths: [] };
    render(<SelectModel />);
    expect(items().map((i) => i.text)).toEqual(["GPT", "Claude"]);
    expect(footer()).toEqual([]);
  });
});

describe("SelectModel locked", () => {
  const items = () => lastComboBoxProps.items as DropDownItemProps[];
  const footer = () => lastComboBoxProps.footerItems as DropDownItemProps[];
  const profiles = [
    { id: "p1", name: "GPT", capabilities: 0x01 },
    { id: "p2", name: "Claude", capabilities: 0x01 },
  ];

  beforeEach(() => {
    mockSetSessionChatProfile.mockClear();
    mockSetReasoningLevel.mockClear();
    mockReasoningLevel = "medium";
    mockReasoningSupport = {
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
    };
    setupStores({ profiles, currentProfile: { id: "p1", name: "GPT" } });
  });

  afterEach(() => {
    mockReasoningLevel = "off";
    mockReasoningSupport = { thinks: false, canDisable: false, depths: [] };
  });

  it("still renders the combobox with the current profile as its value", () => {
    render(<SelectModel locked />);
    const box = screen.getByTestId("combo-box");
    expect(box.getAttribute("data-value")).toBe("GPT");
  });

  it("offers exactly the current profile, then a pinned separator and Effort", () => {
    render(<SelectModel locked />);
    expect(items().map((i) => i.text)).toEqual(["GPT"]);
    expect(items()[0].checked).toBe(true);
    expect(items()[0].id).toBe("p1");
    expect((items()[0] as { "data-testid"?: string })["data-testid"]).toBe(
      "model-selector-current"
    );
    expect(footer().map((i) => i.text)).toEqual(["", "Effort"]);
    expect(footer()[0].isSeparator).toBe(true);
    expect(footer()[1].trailingText).toBe("ThinkingLevelMedium");
  });

  it("the profile row is inert — no switch, no host notification", () => {
    const onSelect = vi.fn();
    render(
      <WidgetConfigProvider config={{ onProfilePickerSelect: onSelect }}>
        <SelectModel locked />
      </WidgetConfigProvider>
    );
    items()[0].onClick(new Event("click"));
    expect(mockSetSessionChatProfile).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("leaves the host actions out", () => {
    const actions: ProfilePickerAction[] = [{ id: "a1", text: "Agent A" }];
    render(
      <WidgetConfigProvider config={{ profilePickerActions: actions }}>
        <SelectModel locked />
      </WidgetConfigProvider>
    );
    expect(items().map((i) => i.text)).toEqual(["GPT"]);
    expect(footer().map((i) => i.text)).toEqual(["", "Effort"]);
  });

  it("Effort still sets the level", () => {
    render(<SelectModel locked />);
    footer()[1].subMenu![0].onClick(new Event("click"));
    expect(mockSetReasoningLevel).toHaveBeenCalledWith("off");
  });

  it("shows only the current profile for a model that cannot think", () => {
    mockReasoningSupport = { thinks: false, canDisable: false, depths: [] };
    render(<SelectModel locked />);
    expect(items().map((i) => i.text)).toEqual(["GPT"]);
    expect(footer()).toEqual([]);
  });

  it("drops the separator when there is no profile to sit above it", () => {
    setupStores({ profiles: [], currentProfile: null });
    render(<SelectModel locked />);
    expect(items()).toEqual([]);
    expect(footer().map((i) => i.text)).toEqual(["Effort"]);
  });

  it("wins over profilePickerReadOnly so Effort stays reachable", () => {
    render(
      <WidgetConfigProvider config={{ profilePickerReadOnly: true }}>
        <SelectModel locked />
      </WidgetConfigProvider>
    );
    expect(screen.queryByTestId("model-selector-readonly")).toBeNull();
    expect(items().map((i) => i.text)).toEqual(["GPT"]);
    expect(footer().map((i) => i.text)).toEqual(["", "Effort"]);
  });
});
