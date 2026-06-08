// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../store/context", () => {
  const cloudsState = {
    cloudProviders: [
      {
        label: "Cloud One",
        url: "https://cloud.example.com",
        apiKey: "ck-123",
      },
    ],
  };
  return {
    useStores: () => ({
      provider: {
        getProvidersInfo: () => [
          {
            type: "openai",
            name: "OpenAI",
            baseUrl: "https://api.openai.com",
          },
          {
            type: "anthropic",
            name: "Anthropic",
            baseUrl: "https://api.anthropic.com",
          },
        ],
        getProviderInfo: (type: string) => ({
          name: type === "openai" ? "OpenAI" : "Anthropic",
        }),
      },
      useCloudsStore: (
        selector?: (s: typeof cloudsState) => unknown
      ) => (selector ? selector(cloudsState) : cloudsState),
    }),
  };
});

vi.mock("../../combo-box", () => ({
  ComboBox: ({
    placeholder,
    value,
    items,
    disabled,
  }: {
    placeholder: string;
    value?: string;
    items: { text: string; id: string; onClick: () => void }[];
    disabled?: boolean;
  }) => (
    <div data-testid={`combo-${placeholder}`}>
      <span data-testid="combo-value">{value ?? placeholder}</span>
      {!disabled &&
        items.map((item) => (
          <button
            key={item.id}
            data-testid={`item-${item.id}`}
            onClick={item.onClick}
          >
            {item.text}
          </button>
        ))}
    </div>
  ),
}));

vi.mock("../../field-container", () => ({
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
    isHorizontal?: boolean;
    reserveErrorSpace?: boolean;
    className?: string;
  }) => (
    <div data-testid={`field-${header}`}>
      <label>{header}</label>
      {action}
      {error && <span data-testid={`error-${header}`}>{error}</span>}
      {children}
    </div>
  ),
}));

vi.mock("../../input", () => ({
  Input: ({
    name,
    placeholder,
    value,
    onChange,
    disabled,
  }: {
    name: string;
    placeholder: string;
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    disabled?: boolean;
    type?: string;
    className?: string;
  }) => (
    <input
      data-testid={`input-${name}`}
      name={name}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={onChange}
    />
  ),
}));

vi.mock("../../link", () => ({
  Link: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
    target?: string;
    variant?: string;
    className?: string;
  }) => (
    <a data-testid="link" href={href}>
      {children}
    </a>
  ),
}));

import {
  ModelConfigForm,
  type ModelFormValues,
} from "../sub-components/ModelConfigForm";
import type { Model } from "../../../../types";

const defaultValues: ModelFormValues = {
  provider: "openai",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com",
  model: "gpt-4",
  profileName: "My Profile",
};

const models: Model[] = [
  { id: "gpt-4", name: "GPT-4", provider: "openai", capabilities: 0 },
  { id: "gpt-3.5", name: "GPT-3.5", provider: "openai", capabilities: 0 },
];

describe("ModelConfigForm", () => {
  it("renders all field containers", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={defaultValues}
        onChange={onChange}
        models={models}
      />
    );
    expect(screen.getByTestId("field-Provider")).toBeInTheDocument();
    expect(screen.getByTestId("field-APIKey")).toBeInTheDocument();
    expect(screen.getByTestId("field-BaseURL")).toBeInTheDocument();
    expect(screen.getByTestId("field-Model")).toBeInTheDocument();
    expect(screen.getByTestId("field-ProfileName")).toBeInTheDocument();
  });

  it("displays errors when provided", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={defaultValues}
        onChange={onChange}
        models={models}
        errors={{ key: "Invalid key", url: "Invalid URL", name: "Name taken" }}
      />
    );
    expect(screen.getByTestId("error-APIKey")).toHaveTextContent("Invalid key");
    expect(screen.getByTestId("error-BaseURL")).toHaveTextContent(
      "Invalid URL"
    );
    expect(screen.getByTestId("error-ProfileName")).toHaveTextContent(
      "Name taken"
    );
  });

  it("calls onChange when API key input changes", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={defaultValues}
        onChange={onChange}
        models={models}
      />
    );
    fireEvent.change(screen.getByTestId("input-key"), {
      target: { value: "new-key" },
    });
    expect(onChange).toHaveBeenCalledWith("apiKey", "new-key");
  });

  it("calls onChange when base URL input changes", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={defaultValues}
        onChange={onChange}
        models={models}
      />
    );
    fireEvent.change(screen.getByTestId("input-url"), {
      target: { value: "https://new.url" },
    });
    expect(onChange).toHaveBeenCalledWith("baseUrl", "https://new.url");
  });

  it("calls onChange when profile name input changes", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={defaultValues}
        onChange={onChange}
        models={models}
      />
    );
    fireEvent.change(screen.getByTestId("input-name"), {
      target: { value: "New Name" },
    });
    expect(onChange).toHaveBeenCalledWith("profileName", "New Name");
  });

  it("calls onChange when a provider item is clicked", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={defaultValues}
        onChange={onChange}
        models={models}
      />
    );
    fireEvent.click(screen.getByTestId("item-openai"));
    expect(onChange).toHaveBeenCalledWith("provider", {
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
    });
  });

  it("calls onChange when a cloud provider item is clicked", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={defaultValues}
        onChange={onChange}
        models={models}
      />
    );
    fireEvent.click(screen.getByTestId("item-https://cloud.example.com"));
    expect(onChange).toHaveBeenCalledWith("provider", {
      type: "onlyoffice",
      baseUrl: "https://cloud.example.com",
      apiKey: "ck-123",
      isCloudProvider: true,
    });
  });

  it("calls onChange when a model item is clicked", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={defaultValues}
        onChange={onChange}
        models={models}
      />
    );
    fireEvent.click(screen.getByTestId("item-gpt-3.5"));
    expect(onChange).toHaveBeenCalledWith("model", "gpt-3.5");
  });

  it("disables inputs when no provider is selected", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={{ ...defaultValues, provider: "" }}
        onChange={onChange}
        models={models}
      />
    );
    expect(screen.getByTestId("input-key")).toBeDisabled();
    expect(screen.getByTestId("input-url")).toBeDisabled();
    expect(screen.getByTestId("input-name")).toBeDisabled();
  });

  it("shows selected provider name", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={defaultValues}
        onChange={onChange}
        models={models}
      />
    );
    const providerField = screen.getByTestId("field-Provider");
    expect(providerField).toHaveTextContent("OpenAI");
  });

  it("shows hostname for cloud provider", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={{
          ...defaultValues,
          isCloudProvider: true,
          baseUrl: "https://cloud.example.com",
        }}
        onChange={onChange}
        models={models}
      />
    );
    const providerField = screen.getByTestId("field-Provider");
    expect(providerField).toHaveTextContent("cloud.example.com");
  });

  it("renders GetAPIKey link when provider has an API key link", () => {
    const onChange = vi.fn();
    render(
      <ModelConfigForm
        values={defaultValues}
        onChange={onChange}
        models={models}
      />
    );
    expect(screen.getByText("GetAPIKey")).toBeInTheDocument();
  });
});
