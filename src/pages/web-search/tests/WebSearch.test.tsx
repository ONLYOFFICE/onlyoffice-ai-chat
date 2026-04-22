// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

vi.mock("../../../hooks/useDirection", () => ({
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

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useCloudsStore: () => ({
      cloudProviders: mockCloudProviders,
    }),
  }),
}));

vi.mock("../../../lib/api-key-links", () => ({
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

import { WebSearch } from "../sub-components";

describe("WebSearch", () => {
  beforeEach(() => {
    mockSetWebSearchData.mockClear();
    mockGetWebSearchData.mockReturnValue(null);
    mockCloudProviders.length = 0;
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

  it("initializes from existing web search data", () => {
    mockGetWebSearchData.mockReturnValue({
      provider: "Exa",
      key: "test-key-123",
      baseUrl: "https://api.exa.ai",
    });
    render(<WebSearch />);
    const apiInput = screen.getByTestId("input-EnterKey");
    expect(apiInput).toHaveValue("test-key-123");
  });

  it("renders Get API Key link for Exa", () => {
    render(<WebSearch />);
    const link = screen.getByTestId("link");
    expect(link).toHaveAttribute("href", "https://exa.ai/keys");
    expect(link).toHaveTextContent("GetAPIKey");
  });

  it("shows base URL field when ONLYOFFICE provider is selected", () => {
    render(<WebSearch />);
    // Click on the ONLYOFFICE combo item
    fireEvent.click(screen.getByTestId("combo-item-ONLYOFFICE"));

    expect(screen.getByTestId("field-BaseURL")).toBeInTheDocument();
  });

  it("validates URL on base URL blur - invalid URL", () => {
    render(<WebSearch />);
    // Select ONLYOFFICE (no baseUrl)
    fireEvent.click(screen.getByTestId("combo-item-ONLYOFFICE"));

    const urlInput = screen.getByTestId("input-EnterURL");
    fireEvent.change(urlInput, { target: { value: "not-a-url" } });
    fireEvent.blur(urlInput);

    expect(screen.getByTestId("field-error")).toHaveTextContent("InvalidUrl");
  });

  it("validates URL on base URL blur - valid URL", () => {
    render(<WebSearch />);
    fireEvent.click(screen.getByTestId("combo-item-ONLYOFFICE"));

    const urlInput = screen.getByTestId("input-EnterURL");
    fireEvent.change(urlInput, { target: { value: "https://example.com" } });
    fireEvent.blur(urlInput);

    expect(screen.queryByTestId("field-error")).not.toBeInTheDocument();
  });

  it("saves data on API key blur with valid API key", () => {
    render(<WebSearch />);
    const apiInput = screen.getByTestId("input-EnterKey");
    fireEvent.change(apiInput, { target: { value: "my-api-key" } });
    fireEvent.blur(apiInput);

    expect(mockSetWebSearchData).toHaveBeenCalledWith({
      provider: "Exa",
      key: "my-api-key",
      baseUrl: "https://api.exa.ai",
    });
  });

  it("clears web search data when API key is empty on blur", () => {
    render(<WebSearch />);
    const apiInput = screen.getByTestId("input-EnterKey");
    fireEvent.change(apiInput, { target: { value: "" } });
    fireEvent.blur(apiInput);

    expect(mockSetWebSearchData).toHaveBeenCalledWith(null);
  });

  it("saves data with base URL for provider without predefined baseUrl", () => {
    render(<WebSearch />);
    fireEvent.click(screen.getByTestId("combo-item-ONLYOFFICE"));

    const urlInput = screen.getByTestId("input-EnterURL");
    fireEvent.change(urlInput, { target: { value: "https://custom.api.com" } });

    const apiInput = screen.getByTestId("input-EnterKey");
    fireEvent.change(apiInput, { target: { value: "key-123" } });
    fireEvent.blur(apiInput);

    expect(mockSetWebSearchData).toHaveBeenCalledWith({
      provider: "ONLYOFFICE",
      key: "key-123",
      baseUrl: "https://custom.api.com",
    });
  });

  it("sets null when base URL is invalid and provider has no default", () => {
    render(<WebSearch />);
    fireEvent.click(screen.getByTestId("combo-item-ONLYOFFICE"));

    const urlInput = screen.getByTestId("input-EnterURL");
    fireEvent.change(urlInput, { target: { value: "invalid" } });

    const apiInput = screen.getByTestId("input-EnterKey");
    fireEvent.change(apiInput, { target: { value: "key-123" } });
    fireEvent.blur(apiInput);

    expect(mockSetWebSearchData).toHaveBeenCalledWith(null);
  });

  it("handles cloud provider selection", () => {
    mockCloudProviders.push({
      url: "https://cloud.example.com",
      label: "My Cloud",
      apiKey: "cloud-key",
    });

    render(<WebSearch />);
    fireEvent.click(screen.getByTestId("combo-item-https://cloud.example.com"));

    expect(mockSetWebSearchData).toHaveBeenCalledWith({
      provider: "https://cloud.example.com",
      key: "cloud-key",
      baseUrl: "https://cloud.example.com",
      isCloudProvider: true,
    });
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

  it("clears base URL error on provider switch", () => {
    render(<WebSearch />);
    // Select ONLYOFFICE, enter invalid URL
    fireEvent.click(screen.getByTestId("combo-item-ONLYOFFICE"));

    const urlInput = screen.getByTestId("input-EnterURL");
    fireEvent.change(urlInput, { target: { value: "bad" } });
    fireEvent.blur(urlInput);
    expect(screen.getByTestId("field-error")).toBeInTheDocument();

    // Switch to Exa - error should be gone
    fireEvent.click(screen.getByTestId("combo-item-Exa"));
    expect(screen.queryByTestId("field-error")).not.toBeInTheDocument();
  });

  it("clears base URL error when typing in the field", () => {
    render(<WebSearch />);
    fireEvent.click(screen.getByTestId("combo-item-ONLYOFFICE"));

    const urlInput = screen.getByTestId("input-EnterURL");
    fireEvent.change(urlInput, { target: { value: "bad" } });
    fireEvent.blur(urlInput);
    expect(screen.getByTestId("field-error")).toBeInTheDocument();

    fireEvent.change(urlInput, { target: { value: "https://new" } });
    expect(screen.queryByTestId("field-error")).not.toBeInTheDocument();
  });

  it("does not write on non-cloud provider selection", () => {
    // Selecting a non-cloud provider no longer clears stored credentials —
    // `setWebSearchData` is only invoked after the user blurs the API-key
    // or base-URL input, so partially-filled forms don't clobber storage.
    render(<WebSearch />);
    fireEvent.click(screen.getByTestId("combo-item-ONLYOFFICE"));

    expect(mockSetWebSearchData).not.toHaveBeenCalled();
  });
});
