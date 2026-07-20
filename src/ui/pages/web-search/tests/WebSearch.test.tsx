// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSetWebSearchData = vi.fn();
const mockGetWebSearchData = vi.fn().mockReturnValue(null);
const mockEventBus = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
const mockServers = {
  getWebSearchData: mockGetWebSearchData,
  setWebSearchData: mockSetWebSearchData,
};
const mockToolsContext = { servers: mockServers, eventBus: mockEventBus };

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../tools/context", () => ({
  useToolsContext: () => mockToolsContext,
}));

const mockCloudProviders: {
  url: string;
  label: string;
  apiKey: string;
}[] = [];

const mockStoreState: {
  externalOnlyofficeConfig?: { baseUrl: string; apiKey?: string };
} = {};

const mockApi = {
  webSearch: {
    getActiveConfig: vi.fn().mockResolvedValue(null),
    setActiveConfig: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
};
const mockCallbacksManager = { emit: vi.fn() };

const mockWidgetConfig: {
  entityId?: string;
  webSearchSaveMode?: "blur" | "button";
} = {};

vi.mock("../../../../widget-config", () => ({
  useWidgetConfig: () => mockWidgetConfig,
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useCloudsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        cloudProviders: mockCloudProviders,
        externalOnlyofficeConfig: mockStoreState.externalOnlyofficeConfig,
        hiddenWebSearchProviders: undefined,
      };
      return selector ? selector(state) : state;
    },
    api: mockApi,
    callbacksManager: mockCallbacksManager,
  }),
}));

vi.mock("../../../../shared/api-key-links", () => ({
  getApiKeyLink: (id: string) =>
    id === "Exa" ? "https://exa.ai/keys" : undefined,
}));

vi.mock("../../../components/combo-box", () => ({
  ComboBox: ({
    value,
    items,
  }: {
    value: string;
    items: { text: string; id: string; onClick: () => void }[];
  }) => {
    return (
      <div data-testid="combo-box">
        <span data-testid="combo-value">{value}</span>
        {items.map((item) => (
          <button
            key={item.id}
            data-testid={`combo-item-${item.id}`}
            onClick={item.onClick}
          >
            {item.text}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock("../../../components/field-container", () => ({
  FieldContainer: ({
    children,
    header,
    error,
    action,
  }: {
    children: React.ReactNode;
    header: string;
    error?: string;
    action?: React.ReactNode;
  }) => (
    <div data-testid={`field-${header}`}>
      <label>{header}</label>
      {error && <span data-testid="field-error">{error}</span>}
      {action}
      {children}
    </div>
  ),
}));

vi.mock("../../../components/input", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactModule = require("react");
  return {
    Input: ReactModule.forwardRef(
      (
        props: {
          placeholder?: string;
          value: string;
          disabled?: boolean;
          onChange?: (e: { target: { value: string } }) => void;
          onBlur?: () => void;
          type?: string;
        },
        ref: React.Ref<HTMLInputElement>
      ) => (
        <input
          ref={ref}
          data-testid={`input-${props.placeholder || "default"}`}
          placeholder={props.placeholder}
          value={props.value}
          disabled={props.disabled}
          onChange={props.onChange}
          onBlur={props.onBlur}
          type={props.type}
        />
      )
    ),
  };
});

vi.mock("../../../components/link", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a data-testid="link" href={href}>
      {children}
    </a>
  ),
}));

vi.mock("../../../components/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    isLoading,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    isLoading?: boolean;
    className?: string;
  }) => (
    // Button mode renders both a Save and a Reset button; disambiguate by
    // the component's class so each maps to its own test id.
    <button
      data-testid={className?.includes("reset") ? "reset-button" : "save-button"}
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {children}
    </button>
  ),
}));

import { WebSearch } from "../sub-components";

describe("WebSearch", () => {
  beforeEach(() => {
    mockApi.webSearch.setActiveConfig.mockClear();
    mockApi.webSearch.clear.mockClear();
    mockApi.webSearch.getActiveConfig.mockResolvedValue(null);
    mockCallbacksManager.emit.mockClear();
    mockCloudProviders.length = 0;
    mockStoreState.externalOnlyofficeConfig = undefined;
    mockWidgetConfig.entityId = undefined;
    mockWidgetConfig.webSearchSaveMode = undefined;
  });

  it("renders description text", () => {
    render(<WebSearch />);
    expect(screen.getByText("WebSearchDescription")).toBeInTheDocument();
  });

  it("renders web search engine selector", () => {
    render(<WebSearch />);
    expect(screen.getByTestId("field-WebSearchEngine")).toBeInTheDocument();
    expect(screen.getByTestId("combo-box")).toBeInTheDocument();
  });

  it("renders API key input field", () => {
    render(<WebSearch />);
    expect(screen.getByTestId("field-APIKey")).toBeInTheDocument();
  });

  it("shows Exa as default provider label", () => {
    render(<WebSearch />);
    expect(screen.getByTestId("combo-value")).toHaveTextContent("Exa");
  });

  it("does not render base URL field when provider has baseUrl (Exa)", () => {
    render(<WebSearch />);
    // Exa has baseUrl defined, so BaseURL field should not appear
    expect(screen.queryByTestId("field-BaseURL")).not.toBeInTheDocument();
  });

  it("renders with page variant", () => {
    render(<WebSearch variant="page" />);
    expect(screen.getByText("WebSearchDescription")).toBeInTheDocument();
  });

  it("initializes from existing web search data", async () => {
    mockApi.webSearch.getActiveConfig.mockResolvedValue({
      provider: "Exa",
      key: "test-key-123",
      baseUrl: "https://api.exa.ai",
    });
    render(<WebSearch />);
    const apiInput = await screen.findByDisplayValue("test-key-123");
    expect(apiInput).toBeInTheDocument();
  });

  it("renders Get API Key link for Exa", () => {
    render(<WebSearch />);
    const link = screen.getByTestId("link");
    expect(link).toHaveAttribute("href", "https://exa.ai/keys");
    expect(link).toHaveTextContent("GetAPIKey");
  });

  it("defaults to Exa", () => {
    render(<WebSearch />);
    expect(screen.getByTestId("combo-value")).toHaveTextContent("Exa");
  });

  it("saves data on API key blur with valid API key", () => {
    render(<WebSearch />);
    const apiInput = screen.getByTestId("input-EnterKey");
    fireEvent.change(apiInput, { target: { value: "my-api-key" } });
    fireEvent.blur(apiInput);

    expect(mockApi.webSearch.setActiveConfig).toHaveBeenCalledWith(
      {
        provider: "Exa",
        key: "my-api-key",
        baseUrl: "https://api.exa.ai",
      },
      undefined
    );
  });

  it("clears web search data when API key is empty on blur", () => {
    render(<WebSearch />);
    const apiInput = screen.getByTestId("input-EnterKey");
    fireEvent.change(apiInput, { target: { value: "" } });
    fireEvent.blur(apiInput);

    expect(mockApi.webSearch.clear).toHaveBeenCalled();
  });

  it("handles cloud provider selection", () => {
    mockCloudProviders.push({
      url: "https://cloud.example.com",
      label: "My Cloud",
      apiKey: "cloud-key",
    });

    render(<WebSearch />);
    fireEvent.click(screen.getByTestId("combo-item-https://cloud.example.com"));

    expect(mockApi.webSearch.setActiveConfig).toHaveBeenCalledWith(
      {
        provider: "https://cloud.example.com",
        key: "cloud-key",
        baseUrl: "https://cloud.example.com",
        isCloudProvider: true,
      },
      undefined
    );
  });

  it("hides API key input for cloud provider", () => {
    mockCloudProviders.push({
      url: "https://cloud.example.com",
      label: "My Cloud",
      apiKey: "cloud-key",
    });

    render(<WebSearch />);
    fireEvent.click(screen.getByTestId("combo-item-https://cloud.example.com"));

    expect(screen.queryByTestId("input-EnterKey")).toBeNull();
  });

  it("does not write on non-cloud provider selection", () => {
    // Selecting a non-cloud provider no longer clears stored credentials —
    // `setWebSearchData` is only invoked after the user blurs the API-key
    // or base-URL input, so partially-filled forms don't clobber storage.
    render(<WebSearch />);
    fireEvent.click(screen.getByTestId("combo-item-Exa"));

    expect(mockApi.webSearch.setActiveConfig).not.toHaveBeenCalled();
    expect(mockApi.webSearch.clear).not.toHaveBeenCalled();
  });

  describe("button save mode", () => {
    it("does not render the Save button in blur mode (default)", () => {
      render(<WebSearch />);
      expect(screen.queryByTestId("save-button")).toBeNull();
    });

    it("renders the Save button in button mode", () => {
      render(<WebSearch saveMode="button" />);
      expect(screen.getByTestId("save-button")).toBeInTheDocument();
    });

    it("takes the mode from WidgetConfig when no prop is given", () => {
      mockWidgetConfig.webSearchSaveMode = "button";
      render(<WebSearch />);
      expect(screen.getByTestId("save-button")).toBeInTheDocument();
    });

    it("prop overrides the WidgetConfig mode", () => {
      mockWidgetConfig.webSearchSaveMode = "button";
      render(<WebSearch saveMode="blur" />);
      expect(screen.queryByTestId("save-button")).toBeNull();
    });

    it("does not persist on API key blur in button mode", () => {
      render(<WebSearch saveMode="button" />);
      const apiInput = screen.getByTestId("input-EnterKey");
      fireEvent.change(apiInput, { target: { value: "my-api-key" } });
      fireEvent.blur(apiInput);

      expect(mockApi.webSearch.setActiveConfig).not.toHaveBeenCalled();
      expect(mockApi.webSearch.clear).not.toHaveBeenCalled();
    });

    it("persists and emits onWebSearchSaved on Save click", async () => {
      render(<WebSearch saveMode="button" />);
      const apiInput = screen.getByTestId("input-EnterKey");
      fireEvent.change(apiInput, { target: { value: "my-api-key" } });
      fireEvent.click(screen.getByTestId("save-button"));

      expect(mockApi.webSearch.setActiveConfig).toHaveBeenCalledWith(
        {
          provider: "Exa",
          key: "my-api-key",
          baseUrl: "https://api.exa.ai",
        },
        undefined
      );
      // `onWebSearchSaved` fires after the awaited persist resolves.
      await waitFor(() =>
        expect(mockCallbacksManager.emit).toHaveBeenCalledWith(
          "onWebSearchSaved",
          {
            enabled: true,
            provider: "Exa",
            isCloudProvider: undefined,
          }
        )
      );
    });

    it("disables the Save button again after a successful save", async () => {
      render(<WebSearch saveMode="button" />);
      const saveButton = screen.getByTestId("save-button");
      fireEvent.change(screen.getByTestId("input-EnterKey"), {
        target: { value: "my-api-key" },
      });
      expect(saveButton).not.toBeDisabled();

      fireEvent.click(saveButton);

      // Once persisted, the form matches storage again, so there is nothing
      // left to save.
      await waitFor(() => expect(saveButton).toBeDisabled());
    });

    it("keeps the Save button disabled until the form has unsaved changes", () => {
      render(<WebSearch saveMode="button" />);
      const saveButton = screen.getByTestId("save-button");
      // No API key yet — nothing to persist.
      expect(saveButton).toBeDisabled();

      fireEvent.change(screen.getByTestId("input-EnterKey"), {
        target: { value: "my-api-key" },
      });
      expect(saveButton).not.toBeDisabled();
    });
  });
});
