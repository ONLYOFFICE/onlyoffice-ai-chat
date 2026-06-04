// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  deleteProfile: vi.fn(async () => {}),
  widgetConfig: {
    onDeleteProfile: undefined as
      | undefined
      | ((p: unknown) => boolean | void | Promise<boolean | void>),
  },
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useProfilesStore: (selector: (s: { deleteProfile: unknown }) => unknown) =>
      selector({ deleteProfile: mocks.deleteProfile }),
  }),
}));

vi.mock("../../../../widget-config", () => ({
  useWidgetConfig: () => mocks.widgetConfig,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../../core/providers", () => ({
  getProvider: (type: string) => ({ getName: () => type.toUpperCase() }),
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
  ToggleButton: () => <div data-testid="toggle" />,
}));

vi.mock("../../provider-logo", () => ({
  ProviderLogo: ({ providerType }: { providerType: string }) => (
    <div data-testid="provider-logo">{providerType}</div>
  ),
}));

vi.mock("../../tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock DropdownMenu to render items so we can click them
vi.mock("../../dropdown", () => ({
  DropdownMenu: ({
    trigger,
    items,
  }: {
    trigger: React.ReactNode;
    items: Array<{
      text: string;
      onClick: () => void;
      isSeparator?: boolean;
      icon?: React.ReactNode;
    }>;
  }) => (
    <div data-testid="dropdown">
      {trigger}
      <div data-testid="dropdown-items">
        {items.map((item, i) =>
          item.isSeparator ? (
            <hr key={i} />
          ) : (
            <button
              key={i}
              data-testid={`dropdown-item-${item.text}`}
              onClick={item.onClick}
            >
              {item.icon}
              {item.text}
            </button>
          )
        )}
      </div>
    </div>
  ),
}));

vi.mock("../../model-config-cards", () => ({
  EditModelCard: ({
    onClose,
    onDelete,
  }: {
    onClose: () => void;
    onDelete: () => void;
  }) => (
    <div data-testid="edit-card">
      <button data-testid="edit-card-close" onClick={onClose}>
        Close
      </button>
      <button data-testid="edit-card-delete" onClick={onDelete}>
        Delete
      </button>
    </div>
  ),
}));

vi.mock("../DeleteProfileDialog", () => ({
  DeleteProfileDialog: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="delete-dialog">
      <button data-testid="delete-dialog-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

import React from "react";
import { ModelCard } from "../index";
import type { Profile } from "../../../../types";

const profile: Profile = {
  id: "p1",
  name: "My GPT-4",
  providerType: "openai",
  baseUrl: "https://api.openai.com",
  key: "sk-test",
  modelId: "gpt-4",
};

// ModelCard is now controlled: edit state lives in the parent. Use a small
// harness so the existing behavioural tests keep exercising the full flow.
const Harness = ({ profile: p }: { profile: Profile }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  return (
    <ModelCard
      profile={p}
      isEditing={isEditing}
      onStartEdit={() => setIsEditing(true)}
      onStopEdit={() => setIsEditing(false)}
    />
  );
};

describe("ModelCard", () => {
  beforeEach(() => {
    mocks.deleteProfile.mockClear();
    mocks.widgetConfig.onDeleteProfile = undefined;
  });

  it("renders profile name", () => {
    render(<Harness profile={profile} />);
    const names = screen.getAllByText("My GPT-4");
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  it("renders provider name", () => {
    render(<Harness profile={profile} />);
    expect(screen.getByText("OPENAI")).toBeInTheDocument();
  });

  it("renders provider logo", () => {
    render(<Harness profile={profile} />);
    expect(screen.getByTestId("provider-logo")).toHaveTextContent("openai");
  });

  it("renders more menu trigger", () => {
    render(<Harness profile={profile} />);
    expect(screen.getByTestId("dropdown")).toBeInTheDocument();
  });

  it("shows hostname for cloud providers", () => {
    const cloudProfile: Profile = {
      ...profile,
      isCloudProvider: true,
      baseUrl: "https://cloud.example.com",
    };
    render(<Harness profile={cloudProfile} />);
    expect(screen.getByText("cloud.example.com")).toBeInTheDocument();
  });

  it("shows EditModelCard when Edit is clicked", () => {
    render(<Harness profile={profile} />);
    expect(screen.queryByTestId("edit-card")).not.toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId("dropdown-item-Edit"));
    });

    expect(screen.getByTestId("edit-card")).toBeInTheDocument();
  });

  it("returns to ModelCard view when EditModelCard close is clicked", () => {
    render(<Harness profile={profile} />);

    act(() => {
      fireEvent.click(screen.getByTestId("dropdown-item-Edit"));
    });
    expect(screen.getByTestId("edit-card")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId("edit-card-close"));
    });
    expect(screen.queryByTestId("edit-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("dropdown")).toBeInTheDocument();
  });

  it("shows DeleteProfileDialog when Delete is clicked from dropdown", () => {
    render(<Harness profile={profile} />);

    act(() => {
      fireEvent.click(screen.getByTestId("dropdown-item-Delete"));
    });

    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
  });

  it("closes DeleteProfileDialog via its onClose", () => {
    render(<Harness profile={profile} />);

    act(() => {
      fireEvent.click(screen.getByTestId("dropdown-item-Delete"));
    });
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId("delete-dialog-close"));
    });
    expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();
  });

  it("shows DeleteProfileDialog from within EditModelCard when onDelete is called", () => {
    render(<Harness profile={profile} />);

    // Enter edit mode
    act(() => {
      fireEvent.click(screen.getByTestId("dropdown-item-Edit"));
    });
    expect(screen.getByTestId("edit-card")).toBeInTheDocument();

    // Click delete inside edit card
    act(() => {
      fireEvent.click(screen.getByTestId("edit-card-delete"));
    });
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
  });

  it("renders dropdown items including separator", () => {
    render(<Harness profile={profile} />);
    expect(screen.getByTestId("dropdown-item-Edit")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-item-Delete")).toBeInTheDocument();
  });

  it("uses onDeleteProfile (no built-in dialog) and deletes on confirm", async () => {
    mocks.widgetConfig.onDeleteProfile = vi.fn(async () => true);
    render(<Harness profile={profile} />);

    act(() => {
      fireEvent.click(screen.getByTestId("dropdown-item-Delete"));
    });

    expect(mocks.widgetConfig.onDeleteProfile).toHaveBeenCalledWith(profile);
    // The built-in confirmation dialog must NOT appear.
    expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.deleteProfile).toHaveBeenCalledWith("p1")
    );
  });

  it("does not delete when onDeleteProfile resolves falsy (cancel)", async () => {
    mocks.widgetConfig.onDeleteProfile = vi.fn(async () => false);
    render(<Harness profile={profile} />);

    act(() => {
      fireEvent.click(screen.getByTestId("dropdown-item-Delete"));
    });

    await waitFor(() =>
      expect(mocks.widgetConfig.onDeleteProfile).toHaveBeenCalled()
    );
    expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();
    expect(mocks.deleteProfile).not.toHaveBeenCalled();
  });

  it("does not delete when onDeleteProfile rejects", async () => {
    mocks.widgetConfig.onDeleteProfile = vi.fn(async () => {
      throw new Error("boom");
    });
    render(<Harness profile={profile} />);

    act(() => {
      fireEvent.click(screen.getByTestId("dropdown-item-Delete"));
    });

    await waitFor(() =>
      expect(mocks.widgetConfig.onDeleteProfile).toHaveBeenCalled()
    );
    expect(mocks.deleteProfile).not.toHaveBeenCalled();
    expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();
  });

  it("routes the edit-card delete through onDeleteProfile when provided", async () => {
    mocks.widgetConfig.onDeleteProfile = vi.fn(async () => true);
    render(<Harness profile={profile} />);

    act(() => {
      fireEvent.click(screen.getByTestId("dropdown-item-Edit"));
    });
    act(() => {
      fireEvent.click(screen.getByTestId("edit-card-delete"));
    });

    expect(mocks.widgetConfig.onDeleteProfile).toHaveBeenCalledWith(profile);
    expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.deleteProfile).toHaveBeenCalledWith("p1")
    );
  });
});
