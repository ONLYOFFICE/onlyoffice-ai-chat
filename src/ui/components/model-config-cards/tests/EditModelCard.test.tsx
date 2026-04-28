// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockFetchModels = vi.fn();
const mockSetIsLoading = vi.fn();
const mockSetErrors = vi.fn();
const mockHandleChange = vi.fn();
const mockEditProfile = vi.fn().mockResolvedValue(true);

let mockValues = {
  provider: "openai",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com",
  model: "gpt-4",
  profileName: "My GPT-4",
  isCloudProvider: undefined as boolean | undefined,
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useProfilesStore: () => ({
      editProfile: mockEditProfile,
    }),
    useCloudsStore: () => ({
      externalOnlyofficeConfig: undefined,
    }),
  }),
}));

vi.mock("../hooks/useModelForm", () => ({
  useModelForm: () => ({
    values: mockValues,
    setValues: vi.fn(),
    models: [{ id: "gpt-4", name: "GPT-4", capabilities: {} }],
    setModels: vi.fn(),
    isLoading: false,
    setIsLoading: mockSetIsLoading,
    errors: {},
    setErrors: mockSetErrors,
    isFormValid: true,
    fetchModels: mockFetchModels,
    handleChange: mockHandleChange,
  }),
}));

vi.mock("../sub-components/ModelCardShell", () => ({
  ModelCardShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-shell">{children}</div>
  ),
}));

vi.mock("../sub-components/ModelConfigForm", () => ({
  ModelConfigForm: () => <div data-testid="config-form" />,
}));

vi.mock("../../button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

vi.mock("../../provider-logo", () => ({
  ProviderLogo: ({ providerType }: { providerType: string }) => (
    <div data-testid="provider-logo">{providerType}</div>
  ),
}));

import { EditModelCard } from "../sub-components/EditModelCard";
import type { Profile } from "../../../../types";

const profile: Profile = {
  id: "p1",
  name: "My GPT-4",
  providerType: "openai",
  baseUrl: "https://api.openai.com",
  key: "sk-test",
  modelId: "gpt-4",
};

describe("EditModelCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditProfile.mockResolvedValue(true);
    mockValues = {
      provider: "openai",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com",
      model: "gpt-4",
      profileName: "My GPT-4",
      isCloudProvider: undefined,
    };
  });

  it("renders within ModelCardShell", () => {
    render(
      <EditModelCard profile={profile} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByTestId("card-shell")).toBeInTheDocument();
  });

  it("renders edit heading", () => {
    render(
      <EditModelCard profile={profile} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("EditAIModel")).toBeInTheDocument();
  });

  it("renders config form", () => {
    render(
      <EditModelCard profile={profile} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByTestId("config-form")).toBeInTheDocument();
  });

  it("renders provider logo", () => {
    render(
      <EditModelCard profile={profile} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByTestId("provider-logo")).toHaveTextContent("openai");
  });

  it("renders profile name", () => {
    render(
      <EditModelCard profile={profile} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("My GPT-4")).toBeInTheDocument();
  });

  it("renders Save, Cancel, and Delete buttons", () => {
    render(
      <EditModelCard profile={profile} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("SaveChanges")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <EditModelCard profile={profile} onClose={onClose} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onDelete when Delete is clicked", () => {
    const onDelete = vi.fn();
    render(
      <EditModelCard profile={profile} onClose={vi.fn()} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("renders delete icon", () => {
    render(
      <EditModelCard profile={profile} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("btn-remove")).toBeInTheDocument();
  });

  it("calls fetchModels on mount", () => {
    render(
      <EditModelCard profile={profile} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(mockFetchModels).toHaveBeenCalledWith(
      "openai",
      "sk-test",
      "https://api.openai.com",
      { keepModelIfExists: true, isCloudProvider: undefined }
    );
  });

  it("calls onClose without editProfile when no changes", async () => {
    const onClose = vi.fn();
    render(
      <EditModelCard profile={profile} onClose={onClose} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByText("SaveChanges"));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
      expect(mockEditProfile).not.toHaveBeenCalled();
    });
  });

  it("calls editProfile when values have changed", async () => {
    mockValues = {
      ...mockValues,
      profileName: "Changed Name",
    };
    const onClose = vi.fn();
    render(
      <EditModelCard profile={profile} onClose={onClose} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByText("SaveChanges"));
    await waitFor(() => {
      expect(mockEditProfile).toHaveBeenCalled();
      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
    });
  });

  it("calls onClose on successful edit", async () => {
    mockValues = { ...mockValues, profileName: "Changed" };
    const onClose = vi.fn();
    render(
      <EditModelCard profile={profile} onClose={onClose} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByText("SaveChanges"));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it("sets errors when editProfile returns error", async () => {
    mockValues = { ...mockValues, profileName: "Changed" };
    mockEditProfile.mockResolvedValue({ field: "name", message: "Taken" });
    render(
      <EditModelCard profile={profile} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByText("SaveChanges"));
    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalledWith({ name: "Taken" });
    });
  });
});
