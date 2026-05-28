// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
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

vi.mock("../../../components/combo-box", () => ({
  ComboBox: (props: Record<string, unknown>) => (
    <div
      data-testid="combo-box"
      data-placeholder={props.placeholder}
      data-value={props.value}
      data-item-count={(props.items as unknown[])?.length ?? 0}
    />
  ),
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

function setupStores(overrides?: {
  profiles?: { id: string; name: string; capabilities?: number }[];
  currentProfile?: { id: string; name: string } | null;
}) {
  const profiles = overrides?.profiles ?? [];
  const currentProfile = overrides?.currentProfile ?? null;

  const profilesState = {
    profiles,
    setSessionChatProfile: mockSetSessionChatProfile,
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
