// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { RoomSkill } from "../../../../core/storage";

const mockFetchRoomSkills = vi.fn();
const mockSetSkillEnabled = vi.fn();
const mockClearContextFolder = vi.fn();

let mockSelected: { cloud: string; room: { id: string; name: string } } | null =
  null;
let mockRoomSkills: RoomSkill[] = [];
let mockDisabledSkillIds: string[] = [];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useCloudsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        selectedContextFolder: mockSelected,
        roomSkills: mockRoomSkills,
        disabledSkillIds: mockDisabledSkillIds,
        fetchRoomSkills: mockFetchRoomSkills,
        setSkillEnabled: mockSetSkillEnabled,
        clearContextFolder: mockClearContextFolder,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
  }),
}));

let mockDropdownItems: unknown[] = [];
let mockDropdownOpen: boolean | undefined;
let mockOnOpenChange: ((open: boolean) => void) | undefined;
vi.mock("../../../components/dropdown", () => ({
  DropdownMenu: ({
    trigger,
    items,
    open,
    onOpenChange,
  }: {
    trigger: React.ReactNode;
    items: unknown[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    mockDropdownItems = items;
    mockDropdownOpen = open;
    mockOnOpenChange = onOpenChange;
    return (
      <div data-testid="dropdown-menu" data-item-count={items.length}>
        {trigger}
      </div>
    );
  },
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: (props: Record<string, unknown>) => (
    <span
      data-testid={`icon-btn-${props.iconName}`}
      className={props.className as string}
    >
      {props.iconName as string}
    </span>
  ),
}));

import { ComposerActionRoom } from "../sub-components/ComposerActionRoom";

type MenuItem = {
  id?: string;
  text: string;
  icon?: React.ReactNode;
  isSeparator?: boolean;
  withToggle?: boolean;
  toggleChecked?: boolean;
  onToggleChange?: (checked: boolean) => void;
  onClick?: () => void;
};
const items = () => mockDropdownItems as MenuItem[];

describe("ComposerActionRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelected = null;
    mockRoomSkills = [];
    mockDisabledSkillIds = [];
    mockDropdownItems = [];
    mockDropdownOpen = undefined;
    mockOnOpenChange = undefined;
  });

  it("renders nothing and fetches nothing while no room is connected", () => {
    const { container } = render(<ComposerActionRoom />);
    expect(container).toBeEmptyDOMElement();
    expect(mockFetchRoomSkills).not.toHaveBeenCalled();
  });

  describe("with a connected room", () => {
    beforeEach(() => {
      mockSelected = {
        cloud: "nct2.onlyoffice.com",
        room: { id: "r1", name: "Vacations" },
      };
      mockRoomSkills = [
        { id: "s1", name: "Skill 1" },
        { id: "s1b", name: "Skill 1" },
        { id: "s2", name: "Skill 2" },
      ];
    });

    it("shows the room name with a chevron as the trigger", () => {
      render(<ComposerActionRoom />);
      const button = screen.getByTestId("composer-room-button");
      expect(button.textContent).toContain("Vacations");
      expect(button.getAttribute("title")).toBe("Vacations");
      expect(screen.getByTestId("icon-btn-arrow")).toBeInTheDocument();
    });

    it("reads the room's skills on mount, once", () => {
      render(<ComposerActionRoom />);
      expect(mockFetchRoomSkills).toHaveBeenCalledTimes(1);
    });

    it("re-reads when a different room gets connected", () => {
      const { rerender } = render(<ComposerActionRoom />);
      mockSelected = {
        cloud: "nct2.onlyoffice.com",
        room: { id: "r2", name: "Roadmaps" },
      };
      rerender(<ComposerActionRoom />);
      expect(mockFetchRoomSkills).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("composer-room-button").textContent).toContain(
        "Roadmaps"
      );
    });

    it("does not re-read on an unrelated re-render", () => {
      const { rerender } = render(<ComposerActionRoom />);
      mockDisabledSkillIds = ["s1"];
      rerender(<ComposerActionRoom />);
      expect(mockFetchRoomSkills).toHaveBeenCalledTimes(1);
    });

    it("lists one switch per skill, then a separator, then Disconnect room", () => {
      render(<ComposerActionRoom />);
      expect(items().map((i) => i.text)).toEqual([
        "Skill 1",
        "Skill 1",
        "Skill 2",
        "",
        "DisconnectRoom",
      ]);
      expect(items()[3].isSeparator).toBe(true);
      // Duplicate names stay apart through the id.
      expect(
        items()
          .slice(0, 3)
          .map((i) => i.id)
      ).toEqual(["room-skill:s1", "room-skill:s1b", "room-skill:s2"]);
    });

    it("skill rows carry the code icon and are on unless disabled", () => {
      mockDisabledSkillIds = ["s2"];
      render(<ComposerActionRoom />);
      const skills = items().slice(0, 3);
      for (const skill of skills) {
        expect(skill.withToggle).toBe(true);
        const { container } = render(<>{skill.icon}</>);
        expect(container.textContent).toBe("code.small");
      }
      expect(skills.map((s) => s.toggleChecked)).toEqual([true, true, false]);
    });

    it("flipping a switch updates that skill only", () => {
      render(<ComposerActionRoom />);
      items()[2].onToggleChange!(false);
      expect(mockSetSkillEnabled).toHaveBeenCalledWith("s2", false);
      items()[0].onToggleChange!(true);
      expect(mockSetSkillEnabled).toHaveBeenCalledWith("s1", true);
      expect(mockClearContextFolder).not.toHaveBeenCalled();
    });

    it("clicking a skill row itself changes nothing", () => {
      render(<ComposerActionRoom />);
      items()[0].onClick!();
      expect(mockSetSkillEnabled).not.toHaveBeenCalled();
      expect(mockClearContextFolder).not.toHaveBeenCalled();
    });

    it("Disconnect room clears the selection and closes the menu", () => {
      render(<ComposerActionRoom />);
      act(() => {
        mockOnOpenChange!(true);
      });
      expect(mockDropdownOpen).toBe(true);
      act(() => {
        items().find((i) => i.id === "disconnect-room")!.onClick!();
      });
      expect(mockClearContextFolder).toHaveBeenCalledTimes(1);
      expect(mockDropdownOpen).toBe(false);
    });

    it("offers only Disconnect room when the room has no skills", () => {
      mockRoomSkills = [];
      render(<ComposerActionRoom />);
      expect(items().map((i) => i.text)).toEqual(["DisconnectRoom"]);
      expect(items().find((i) => i.isSeparator)).toBeUndefined();
    });

    it("disappears once the room is disconnected", () => {
      const { rerender, container } = render(<ComposerActionRoom />);
      mockSelected = null;
      rerender(<ComposerActionRoom />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
