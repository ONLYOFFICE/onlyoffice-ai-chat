// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSetValues = vi.fn();
const mockSetModels = vi.fn();
const mockSetIsLoading = vi.fn();
const mockSetErrors = vi.fn();
const mockHandleChange = vi.fn();
const mockAddProfile = vi.fn().mockResolvedValue(true);

let mockIsFormValid = true;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useProfilesStore: () => ({
      addProfile: mockAddProfile,
    }),
  }),
}));

vi.mock("../hooks/useModelForm", () => ({
  useModelForm: () => ({
    values: {
      provider: "openai",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com",
      model: "gpt-4",
      profileName: "My Profile",
    },
    setValues: mockSetValues,
    models: [{ id: "gpt-4", name: "GPT-4", capabilities: { chat: true } }],
    setModels: mockSetModels,
    isLoading: false,
    setIsLoading: mockSetIsLoading,
    errors: {},
    setErrors: mockSetErrors,
    isFormValid: mockIsFormValid,
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

vi.mock("../../link", () => ({
  Link: ({
    children,
  }: {
    children: React.ReactNode;
    href?: string;
    variant?: string;
    className?: string;
  }) => <a>{children}</a>,
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
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { AddModelCard } from "../sub-components/AddModelCard";

describe("AddModelCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFormValid = true;
    mockAddProfile.mockResolvedValue(true);
  });

  it("renders in card variant with ModelCardShell", () => {
    render(<AddModelCard variant="card" />);
    expect(screen.getByTestId("card-shell")).toBeInTheDocument();
    expect(screen.getByText("ConnectNewAIModel")).toBeInTheDocument();
  });

  it("renders config form", () => {
    render(<AddModelCard />);
    expect(screen.getByTestId("config-form")).toBeInTheDocument();
  });

  it("renders Add Model button", () => {
    render(<AddModelCard />);
    expect(screen.getByText("AddModel")).toBeInTheDocument();
  });

  it("renders Cancel button in card variant", () => {
    render(<AddModelCard variant="card" />);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("does not render Cancel button in standalone variant", () => {
    render(<AddModelCard variant="standalone" />);
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<AddModelCard variant="card" onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders standalone variant with different heading", () => {
    render(<AddModelCard variant="standalone" />);
    expect(screen.getByText("ConnectAIModelToEnableChat")).toBeInTheDocument();
    expect(screen.queryByTestId("card-shell")).not.toBeInTheDocument();
  });

  it("renders Import link", () => {
    render(<AddModelCard />);
    expect(screen.getByText("Import")).toBeInTheDocument();
  });

  it("renders tooltip info button", () => {
    render(<AddModelCard />);
    expect(screen.getByTestId("icon-btn-btn-menu-about")).toBeInTheDocument();
  });

  it("calls addProfile on Add Model button click", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <AddModelCard variant="card" onSuccess={onSuccess} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("AddModel"));
    await waitFor(() => {
      expect(mockAddProfile).toHaveBeenCalledWith({
        name: "My Profile",
        providerType: "openai",
        baseUrl: "https://api.openai.com",
        key: "sk-test",
        modelId: "gpt-4",
        capabilities: { chat: true },
        isCloudProvider: undefined,
      });
    });
  });

  it("calls onSuccess and onClose on successful add", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <AddModelCard variant="card" onSuccess={onSuccess} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("AddModel"));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
      expect(mockSetValues).toHaveBeenCalled();
      expect(mockSetModels).toHaveBeenCalledWith([]);
    });
  });

  it("sets errors when addProfile returns error object", async () => {
    mockAddProfile.mockResolvedValue({ field: "key", message: "Invalid" });
    render(<AddModelCard variant="card" />);
    fireEvent.click(screen.getByText("AddModel"));
    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalledWith({ key: "Invalid" });
    });
  });

  it("toggles tooltip visibility when info button is clicked", () => {
    render(<AddModelCard />);
    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip.getAttribute("data-open")).toBe("false");
    fireEvent.click(screen.getByTestId("icon-btn-btn-menu-about"));
    // After click, tooltip open state should be toggled
    expect(screen.getByTestId("tooltip").getAttribute("data-open")).toBe(
      "true"
    );
  });

  it("renders tooltip content with template info", () => {
    render(<AddModelCard />);
    expect(screen.getByText("EnterModelConfigTooltip")).toBeInTheDocument();
    expect(screen.getByText("DownloadTemplate")).toBeInTheDocument();
  });

  it("sets isLoading true during add operation", async () => {
    render(<AddModelCard variant="card" />);
    fireEvent.click(screen.getByText("AddModel"));
    await waitFor(() => {
      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
      expect(mockSetIsLoading).toHaveBeenCalledWith(false);
    });
  });

  it("clears errors before add operation", async () => {
    render(<AddModelCard variant="card" />);
    fireEvent.click(screen.getByText("AddModel"));
    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalledWith({});
    });
  });
});
