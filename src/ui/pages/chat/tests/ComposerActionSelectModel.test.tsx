// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockSetSessionChatProfile = vi.fn();
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
