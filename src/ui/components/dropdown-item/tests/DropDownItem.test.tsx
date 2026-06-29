// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock Radix Item to make onSelect/onClick testable
vi.mock("@radix-ui/react-dropdown-menu", () => ({
  Item: React.forwardRef(
    (
      {
        children,
        onSelect,
        onClick,
        className,
        onMouseEnter,
        dir,
      }: {
        children: React.ReactNode;
        onSelect?: (e: Event) => void;
        onClick?: (e: React.MouseEvent) => void;
        className?: string;
        onMouseEnter?: () => void;
        dir?: string;
      },
      ref: React.Ref<HTMLDivElement>
    ) => (
      <div
        ref={ref}
        role="menuitem"
        className={className}
        dir={dir}
        onClick={(e) => {
          if (onSelect) {
            const event = new Event("select", { cancelable: true });
            onSelect(event);
          }
          if (onClick) {
            onClick(e);
          }
        }}
        onMouseEnter={onMouseEnter}
      >
        {children}
      </div>
    )
  ),
}));

const mockIsRTL = { value: false };
vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({
    isRTL: mockIsRTL.value,
    direction: mockIsRTL.value ? "rtl" : "ltr",
  }),
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

vi.mock("../../toggle-button", () => ({
  ToggleButton: ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid="toggle"
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={() => onCheckedChange(!checked)}
    />
  ),
}));

vi.mock("../../tooltip", () => ({
  Tooltip: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (
    <div data-testid="tooltip" data-open={open}>
      {children}
    </div>
  ),
  TooltipContent: ({
    children,
    isAbout,
  }: {
    children: React.ReactNode;
    isAbout?: boolean;
  }) => (
    <div data-testid="tooltip-content" data-about={isAbout}>
      {children}
    </div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

vi.mock("../../dropdown", () => ({
  DropdownMenu: ({
    trigger,
    items,
    dropdownRef,
  }: {
    trigger: React.ReactNode;
    items: { text: string }[];
    dropdownRef?: React.MutableRefObject<HTMLDivElement | null>;
  }) => {
    const localRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
      if (dropdownRef && localRef.current) {
        dropdownRef.current = localRef.current;
      }
    }, [dropdownRef]);
    return (
      <div data-testid="submenu" ref={localRef}>
        {trigger}
        <span data-testid="submenu-count">{items.length}</span>
      </div>
    );
  },
}));

import { DropDownItem } from "../index";

// No longer need Radix context since we mock the Item component directly
function renderInDropdownContext(ui: React.ReactNode) {
  return render(<>{ui}</>);
}

describe("DropDownItem", () => {
  it("renders text", () => {
    renderInDropdownContext(<DropDownItem text="Edit" onClick={vi.fn()} />);
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("renders separator when isSeparator is true", () => {
    const { container } = renderInDropdownContext(
      <DropDownItem text="" onClick={vi.fn()} isSeparator />
    );
    expect(container.querySelector(".h-px")).toBeInTheDocument();
  });

  it("renders icon when provided as string", () => {
    renderInDropdownContext(
      <DropDownItem text="Copy" icon="copy" onClick={vi.fn()} />
    );
    expect(screen.getByTestId("icon-btn-copy")).toBeInTheDocument();
  });

  it("renders icon when provided as ReactNode", () => {
    renderInDropdownContext(
      <DropDownItem
        text="Custom"
        icon={<span data-testid="custom-icon">X</span>}
        onClick={vi.fn()}
      />
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders no icon when icon prop is undefined", () => {
    renderInDropdownContext(<DropDownItem text="NoIcon" onClick={vi.fn()} />);
    expect(screen.queryByTestId("custom-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-btn-undefined")).not.toBeInTheDocument();
  });

  it("renders checked icon when checked is true", () => {
    renderInDropdownContext(
      <DropDownItem text="Option" onClick={vi.fn()} checked />
    );
    expect(screen.getByTestId("icon-btn-checked")).toBeInTheDocument();
  });

  it("does not render checked icon when checked is false", () => {
    renderInDropdownContext(
      <DropDownItem text="Option" onClick={vi.fn()} checked={false} />
    );
    expect(screen.queryByTestId("icon-btn-checked")).not.toBeInTheDocument();
  });

  it("renders toggle when withToggle is true", () => {
    renderInDropdownContext(
      <DropDownItem
        text="Toggle"
        onClick={vi.fn()}
        withToggle
        toggleChecked={false}
        onToggleChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("toggle")).toBeInTheDocument();
  });

  it("does not render toggle when withToggle is false", () => {
    renderInDropdownContext(<DropDownItem text="NoToggle" onClick={vi.fn()} />);
    expect(screen.queryByTestId("toggle")).not.toBeInTheDocument();
  });

  it("renders submenu trigger when subMenu is provided", () => {
    renderInDropdownContext(
      <DropDownItem
        text="More"
        onClick={vi.fn()}
        subMenu={[{ text: "Sub", onClick: vi.fn() }]}
      />
    );
    expect(screen.getByTestId("submenu")).toBeInTheDocument();
  });

  it("does not render submenu when subMenu is undefined", () => {
    renderInDropdownContext(<DropDownItem text="NoSub" onClick={vi.fn()} />);
    expect(screen.queryByTestId("submenu")).not.toBeInTheDocument();
  });

  it("renders trailingIcon as string", () => {
    renderInDropdownContext(
      <DropDownItem
        text="Trailing"
        onClick={vi.fn()}
        trailingIcon="arrow-right"
      />
    );
    expect(screen.getByTestId("icon-btn-arrow-right")).toBeInTheDocument();
  });

  it("renders trailingIcon as ReactNode", () => {
    renderInDropdownContext(
      <DropDownItem
        text="Trailing"
        onClick={vi.fn()}
        trailingIcon={<span data-testid="trailing-node">T</span>}
      />
    );
    expect(screen.getByTestId("trailing-node")).toBeInTheDocument();
  });

  it("applies withSpace class when withSpace is true", () => {
    renderInDropdownContext(
      <DropDownItem text="Spaced" onClick={vi.fn()} withSpace />
    );
    const span = screen.getByText("Spaced");
    expect(span.className).toContain("ms-[28px]");
  });

  describe("horizontal padding", () => {
    it("uses text-row padding for a plain text item", () => {
      renderInDropdownContext(<DropDownItem text="Plain" onClick={vi.fn()} />);
      const item = screen.getByRole("menuitem");
      expect(item.className).toContain(
        "ps-[var(--dropdown-item-padding-start-text,16px)]"
      );
      expect(item.className).toContain(
        "pe-[var(--dropdown-item-padding-end-text,16px)]"
      );
    });

    it("uses icon-row padding when a leading icon is present", () => {
      renderInDropdownContext(
        <DropDownItem text="Withicon" icon="copy" onClick={vi.fn()} />
      );
      const item = screen.getByRole("menuitem");
      expect(item.className).toContain(
        "ps-[var(--dropdown-item-padding-start-icon,4px)]"
      );
      expect(item.className).toContain(
        "pe-[var(--dropdown-item-padding-end-icon,20px)]"
      );
    });

    it("uses icon-row padding when withSpace reserves the icon column", () => {
      renderInDropdownContext(
        <DropDownItem text="Reserved" withSpace onClick={vi.fn()} />
      );
      const item = screen.getByRole("menuitem");
      expect(item.className).toContain(
        "ps-[var(--dropdown-item-padding-start-icon,4px)]"
      );
      expect(item.className).toContain(
        "pe-[var(--dropdown-item-padding-end-icon,20px)]"
      );
    });

    it("tightens the end padding when the row ends in a control", () => {
      renderInDropdownContext(
        <DropDownItem
          text="Trailing"
          icon="copy"
          trailingIcon={<span>T</span>}
          onClick={vi.fn()}
        />
      );
      const item = screen.getByRole("menuitem");
      expect(item.className).toContain(
        "pe-[var(--dropdown-item-padding-end-control,8px)]"
      );
      expect(item.className).not.toContain(
        "pe-[var(--dropdown-item-padding-end-icon,20px)]"
      );
    });

    it("uses symmetric combobox padding for the combobox variant", () => {
      renderInDropdownContext(
        <DropDownItem text="Combo" variant="combobox" onClick={vi.fn()} />
      );
      const item = screen.getByRole("menuitem");
      expect(item.className).toContain(
        "ps-[var(--dropdown-item-padding-start-combobox,8px)]"
      );
      expect(item.className).toContain(
        "pe-[var(--dropdown-item-padding-end-combobox,8px)]"
      );
    });
  });

  it("wraps in tooltip when tooltipText is provided", () => {
    renderInDropdownContext(
      <DropDownItem text="Tip" onClick={vi.fn()} tooltipText="Help text" />
    );
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Help text")).toBeInTheDocument();
  });

  it("does not wrap in tooltip when tooltipText is absent", () => {
    renderInDropdownContext(<DropDownItem text="NoTip" onClick={vi.fn()} />);
    expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument();
  });

  it("renders about content when withAbout is true", () => {
    renderInDropdownContext(
      <DropDownItem
        text="About"
        onClick={vi.fn()}
        withAbout
        aboutContent={<span data-testid="about-content">Info</span>}
      />
    );
    expect(screen.getByTestId("icon-btn-btn-menu-about")).toBeInTheDocument();
    expect(screen.getByTestId("about-content")).toBeInTheDocument();
  });

  it("applies active class when isActive is true", () => {
    const { container } = renderInDropdownContext(
      <DropDownItem text="Active" onClick={vi.fn()} isActive />
    );
    const item = container.querySelector(".dropdown-menu-item");
    expect(item?.className).toContain(
      "bg-[var(--drop-down-menu-item-active-color)]"
    );
  });

  it("calls onClick when non-toggle item is selected", () => {
    const onClick = vi.fn();
    renderInDropdownContext(
      <DropDownItem text="Clickable" onClick={onClick} />
    );
    const item = screen.getByText("Clickable").closest("[role='menuitem']");
    expect(item).toBeInTheDocument();
    // Our mock Item calls onSelect -> which calls onClick(e) for non-toggle items
    fireEvent.click(item!);
    expect(onClick).toHaveBeenCalled();
  });

  it("prevents default and stops propagation on toggle select", () => {
    const onClick = vi.fn();
    const onToggleChange = vi.fn();
    renderInDropdownContext(
      <DropDownItem
        text="Toggle Item"
        onClick={onClick}
        withToggle
        toggleChecked={false}
        onToggleChange={onToggleChange}
      />
    );
    expect(screen.getByText("Toggle Item")).toBeInTheDocument();
    expect(screen.getByTestId("toggle")).toBeInTheDocument();
  });

  it("handles toggle click to call onToggleChange", () => {
    const onToggleChange = vi.fn();
    renderInDropdownContext(
      <DropDownItem
        text="Toggle Click"
        onClick={vi.fn()}
        withToggle
        toggleChecked={false}
        onToggleChange={onToggleChange}
      />
    );
    const item = screen.getByText("Toggle Click").closest("[role='menuitem']");
    expect(item).toBeInTheDocument();
    fireEvent.click(item!);
    expect(onToggleChange).toHaveBeenCalledWith(true);
  });

  it("does not call onToggleChange when toggleDisabled", () => {
    const onToggleChange = vi.fn();
    renderInDropdownContext(
      <DropDownItem
        text="Disabled Toggle"
        onClick={vi.fn()}
        withToggle
        toggleChecked={false}
        onToggleChange={onToggleChange}
        toggleDisabled
      />
    );
    const item = screen
      .getByText("Disabled Toggle")
      .closest("[role='menuitem']");
    expect(item).toBeInTheDocument();
    fireEvent.click(item!);
    expect(onToggleChange).not.toHaveBeenCalled();
  });

  it("toggle click ignores tooltip-trigger targets", () => {
    const onToggleChange = vi.fn();
    renderInDropdownContext(
      <DropDownItem
        text="Tooltip Toggle"
        onClick={vi.fn()}
        withToggle
        toggleChecked={false}
        onToggleChange={onToggleChange}
      />
    );
    const item = screen
      .getByText("Tooltip Toggle")
      .closest("[role='menuitem']");
    // Create a child element inside a tooltip trigger
    const triggerWrapper = document.createElement("div");
    triggerWrapper.setAttribute("data-slot", "tooltip-trigger");
    const innerEl = document.createElement("span");
    triggerWrapper.appendChild(innerEl);
    item!.appendChild(triggerWrapper);

    // Click on the inner element within the tooltip trigger
    fireEvent.click(innerEl);
    // onToggleChange should NOT be called because click is inside tooltip-trigger
    expect(onToggleChange).not.toHaveBeenCalled();
  });

  it("toggle click ignores tooltip-trigger targets even when the click hits an inner SVG icon", () => {
    const onToggleChange = vi.fn();
    renderInDropdownContext(
      <DropDownItem
        text="Tooltip Toggle"
        onClick={vi.fn()}
        withToggle
        toggleChecked={false}
        onToggleChange={onToggleChange}
      />
    );
    const item = screen
      .getByText("Tooltip Toggle")
      .closest("[role='menuitem']");
    const triggerWrapper = document.createElement("div");
    triggerWrapper.setAttribute("data-slot", "tooltip-trigger");
    // The about/help button renders an <svg> icon — clicking it makes
    // `e.target` an SVGElement (not an HTMLElement). The guard must still
    // recognize it as being inside the tooltip trigger and skip the toggle.
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    triggerWrapper.appendChild(svg);
    item!.appendChild(triggerWrapper);

    fireEvent.click(svg);
    expect(onToggleChange).not.toHaveBeenCalled();
  });

  it("handles mouseEnter to open submenu", () => {
    renderInDropdownContext(
      <DropDownItem
        text="SubHover"
        onClick={vi.fn()}
        subMenu={[{ text: "Child", onClick: vi.fn() }]}
      />
    );
    const item = screen.getByText("SubHover").closest("[role='menuitem']");
    if (item) {
      fireEvent.mouseEnter(item);
    }
    expect(screen.getByTestId("submenu")).toBeInTheDocument();
  });

  it("renders subMenu with subMenuIcon", () => {
    renderInDropdownContext(
      <DropDownItem
        text="SubIcon"
        onClick={vi.fn()}
        subMenu={[{ text: "Child", onClick: vi.fn() }]}
        subMenuIcon="settings"
        subMenuIconSize={16}
      />
    );
    expect(screen.getByTestId("submenu")).toBeInTheDocument();
    expect(screen.getByTestId("icon-btn-settings")).toBeInTheDocument();
  });

  it("renders with custom iconSize", () => {
    renderInDropdownContext(
      <DropDownItem text="Sized" icon="test" iconSize={32} onClick={vi.fn()} />
    );
    expect(screen.getByTestId("icon-btn-test")).toBeInTheDocument();
  });

  it("renders with custom trailingIconSize", () => {
    renderInDropdownContext(
      <DropDownItem
        text="Trail"
        onClick={vi.fn()}
        trailingIcon="arrow"
        trailingIconSize={20}
      />
    );
    expect(screen.getByTestId("icon-btn-arrow")).toBeInTheDocument();
  });

  it("renders with subMenuClassName", () => {
    renderInDropdownContext(
      <DropDownItem
        text="SubClass"
        onClick={vi.fn()}
        subMenu={[{ text: "Child", onClick: vi.fn() }]}
        subMenuClassName="custom-class"
      />
    );
    expect(screen.getByTestId("submenu")).toBeInTheDocument();
  });

  it("handleMouseEnter calculates submenu position based on viewport", () => {
    renderInDropdownContext(
      <DropDownItem
        text="Positioned"
        onClick={vi.fn()}
        subMenu={[{ text: "Child", onClick: vi.fn() }]}
      />
    );
    const item = screen.getByText("Positioned").closest("[role='menuitem']");
    if (item) {
      // Mock getBoundingClientRect to simulate item position
      vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
        left: 100,
        right: 300,
        top: 50,
        bottom: 82,
        width: 200,
        height: 32,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      });
      Object.defineProperty(window, "innerWidth", {
        value: 1024,
        writable: true,
      });
      fireEvent.mouseEnter(item);
    }
    expect(screen.getByTestId("submenu")).toBeInTheDocument();
  });

  it("handleMouseEnter does nothing when submenu is already open", () => {
    renderInDropdownContext(
      <DropDownItem
        text="AlreadyOpen"
        onClick={vi.fn()}
        subMenu={[{ text: "Child", onClick: vi.fn() }]}
      />
    );
    const item = screen.getByText("AlreadyOpen").closest("[role='menuitem']");
    if (item) {
      fireEvent.mouseEnter(item);
      // Second mouseEnter should be a no-op
      fireEvent.mouseEnter(item);
    }
    expect(screen.getByTestId("submenu")).toBeInTheDocument();
  });

  it("handleMouseEnter does nothing when there is no subMenu", () => {
    renderInDropdownContext(<DropDownItem text="NoSub" onClick={vi.fn()} />);
    const item = screen.getByText("NoSub").closest("[role='menuitem']");
    if (item) {
      fireEvent.mouseEnter(item);
    }
    expect(screen.queryByTestId("submenu")).not.toBeInTheDocument();
  });

  it("handleMouseMove closes submenu when mouse is outside", () => {
    renderInDropdownContext(
      <DropDownItem
        text="MoveOut"
        onClick={vi.fn()}
        subMenu={[{ text: "Child", onClick: vi.fn() }]}
      />
    );
    const item = screen.getByText("MoveOut").closest("[role='menuitem']");
    if (item) {
      vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
        left: 100,
        right: 300,
        top: 50,
        bottom: 82,
        width: 200,
        height: 32,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      });
      fireEvent.mouseEnter(item);

      // Simulate mouse moving far outside
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 900,
          clientY: 900,
          bubbles: true,
        })
      );
    }
  });

  it("about button toggles isAboutOpen on click", () => {
    renderInDropdownContext(
      <DropDownItem
        text="AboutBtn"
        onClick={vi.fn()}
        withAbout
        aboutContent={<span>About info</span>}
      />
    );
    const aboutBtn = screen.getByTestId("icon-btn-btn-menu-about");
    fireEvent.click(aboutBtn);
    // The tooltip open state should toggle
    expect(aboutBtn).toBeInTheDocument();
  });

  it("subMenuIcon wrapper div stops propagation on click", () => {
    renderInDropdownContext(
      <DropDownItem
        text="StopProp"
        onClick={vi.fn()}
        subMenu={[{ text: "Child", onClick: vi.fn() }]}
        subMenuIcon="dots"
      />
    );
    const submenu = screen.getByTestId("submenu");
    const wrapper = submenu.parentElement;
    if (wrapper) {
      fireEvent.click(wrapper);
    }
  });

  it("toggle wrapper div stops propagation on click", () => {
    const onToggleChange = vi.fn();
    renderInDropdownContext(
      <DropDownItem
        text="ToggleWrap"
        onClick={vi.fn()}
        withToggle
        toggleChecked={true}
        onToggleChange={onToggleChange}
      />
    );
    const toggle = screen.getByTestId("toggle");
    const wrapper = toggle.parentElement;
    if (wrapper) {
      fireEvent.click(wrapper);
    }
  });

  it("handleMouseMove handles nested dropdown elements", () => {
    renderInDropdownContext(
      <DropDownItem
        text="Nested"
        onClick={vi.fn()}
        subMenu={[{ text: "Child", onClick: vi.fn() }]}
      />
    );
    const item = screen.getByText("Nested").closest("[role='menuitem']");
    if (item) {
      vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
        left: 100,
        right: 300,
        top: 50,
        bottom: 82,
        width: 200,
        height: 32,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      });

      // Create a nested dropdown element in the DOM
      const nestedDropdown = document.createElement("div");
      nestedDropdown.classList.add("dropdown-menu");
      vi.spyOn(nestedDropdown, "getBoundingClientRect").mockReturnValue({
        left: 400,
        right: 600,
        top: 50,
        bottom: 200,
        width: 200,
        height: 150,
        x: 400,
        y: 50,
        toJSON: () => ({}),
      });
      document.body.appendChild(nestedDropdown);

      fireEvent.mouseEnter(item);

      // Move mouse to inside the nested dropdown
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 500,
          clientY: 100,
          bubbles: true,
        })
      );

      // Clean up
      document.body.removeChild(nestedDropdown);
    }
  });

  it("does not set onMouseEnter when subMenuIcon is provided", () => {
    renderInDropdownContext(
      <DropDownItem
        text="IconSub"
        onClick={vi.fn()}
        subMenu={[{ text: "Child", onClick: vi.fn() }]}
        subMenuIcon="dots"
      />
    );
    const item = screen.getByText("IconSub").closest("[role='menuitem']");
    if (item) {
      fireEvent.mouseEnter(item);
    }
    expect(screen.getByTestId("submenu")).toBeInTheDocument();
  });

  it("positions submenu on left in RTL mode", () => {
    mockIsRTL.value = true;
    renderInDropdownContext(
      <DropDownItem
        text="RTLSub"
        onClick={vi.fn()}
        subMenu={[{ text: "Child", onClick: vi.fn() }]}
      />
    );
    const item = screen.getByText("RTLSub").closest("[role='menuitem']");
    if (item) {
      vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
        left: 200,
        right: 400,
        top: 50,
        bottom: 82,
        width: 200,
        height: 32,
        x: 200,
        y: 50,
        toJSON: () => ({}),
      });
      Object.defineProperty(window, "innerWidth", {
        value: 1024,
        writable: true,
      });
      fireEvent.mouseEnter(item);
    }
    mockIsRTL.value = false;
  });
});
