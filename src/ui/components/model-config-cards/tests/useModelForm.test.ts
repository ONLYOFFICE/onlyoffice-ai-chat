// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockGetProviderModels = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => {
  const cloudsState = { externalOnlyofficeConfig: undefined };
  return {
    useStores: () => ({
      useCloudsStore: (selector?: (s: typeof cloudsState) => unknown) =>
        selector ? selector(cloudsState) : cloudsState,
    }),
  };
});

vi.mock("../../../../core/providers", () => ({
  getProviderName: () => "OpenAI",
}));

vi.mock("../../../providers/ApiProvider", () => ({
  useApi: () => ({
    profiles: {
      listProviderModels: (input: {
        providerType: string;
        baseUrl: string;
        apiKey: string;
      }) =>
        mockGetProviderModels({ baseUrl: input.baseUrl, apiKey: input.apiKey }),
    },
  }),
}));

vi.mock("../../../../hooks/useDebouncedCallback", () => ({
  useDebouncedCallback: (fn: (...args: unknown[]) => void) => {
    const debounced = (...args: unknown[]) => fn(...args);
    debounced.cancel = vi.fn();
    return debounced;
  },
}));

import { useModelForm } from "../hooks/useModelForm";
import type { ModelFormValues } from "../sub-components/ModelConfigForm";

const initialValues: ModelFormValues = {
  provider: "",
  apiKey: "",
  baseUrl: "",
  model: "",
  profileName: "",
};

describe("useModelForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Dated so the picker order (newest first) matches the list order.
    mockGetProviderModels.mockResolvedValue([
      {
        id: "gpt-4",
        name: "GPT-4",
        provider: "openai",
        capabilities: 0,
        created: 1_680_000_000,
      },
      {
        id: "gpt-3.5",
        name: "GPT-3.5",
        provider: "openai",
        capabilities: 0,
        created: 1_670_000_000,
      },
    ]);
  });

  it("returns initial state", () => {
    const { result } = renderHook(() => useModelForm(initialValues));
    expect(result.current.values).toEqual(initialValues);
    expect(result.current.models).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.errors).toEqual({});
    expect(result.current.isFormValid).toBe(false);
  });

  it("handleChange updates profileName", () => {
    const { result } = renderHook(() => useModelForm(initialValues));
    act(() => {
      result.current.handleChange("profileName", "Test Profile");
    });
    expect(result.current.values.profileName).toBe("Test Profile");
  });

  it("handleChange for provider sets provider and triggers fetchModels", async () => {
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      result.current.handleChange("provider", {
        type: "openai" as const,
        baseUrl: "https://api.openai.com",
      });
    });
    expect(result.current.values.provider).toBe("openai");
    expect(result.current.values.baseUrl).toBe("https://api.openai.com");
    expect(mockGetProviderModels).toHaveBeenCalled();
  });

  it("handleChange for apiKey triggers debounced fetchModels", () => {
    const { result } = renderHook(() =>
      useModelForm({
        ...initialValues,
        provider: "openai",
        baseUrl: "https://api.openai.com",
      })
    );
    act(() => {
      result.current.handleChange("apiKey", "sk-new-key");
    });
    expect(result.current.values.apiKey).toBe("sk-new-key");
  });

  it("handleChange for baseUrl triggers debounced fetchModels", () => {
    const { result } = renderHook(() =>
      useModelForm({ ...initialValues, provider: "openai" })
    );
    act(() => {
      result.current.handleChange("baseUrl", "https://new.url");
    });
    expect(result.current.values.baseUrl).toBe("https://new.url");
  });

  it("handleChange for model updates model and profileName", () => {
    const { result } = renderHook(() =>
      useModelForm({
        ...initialValues,
        provider: "openai",
        baseUrl: "https://api.openai.com",
      })
    );
    // Set models first by calling setModels
    act(() => {
      result.current.setModels([
        { id: "gpt-4", name: "GPT-4", provider: "openai", capabilities: 0 },
      ]);
    });
    act(() => {
      result.current.handleChange("model", "gpt-4");
    });
    expect(result.current.values.model).toBe("gpt-4");
    expect(result.current.values.profileName).toBe("OpenAI - GPT-4");
  });

  it("isFormValid is true when all required fields are filled", () => {
    const { result } = renderHook(() =>
      useModelForm({
        provider: "openai",
        apiKey: "sk-key",
        baseUrl: "https://api.openai.com",
        model: "gpt-4",
        profileName: "My GPT",
      })
    );
    expect(result.current.isFormValid).toBe(true);
  });

  it("isFormValid is false when provider is empty", () => {
    const { result } = renderHook(() =>
      useModelForm({
        provider: "",
        apiKey: "sk-key",
        baseUrl: "https://api.openai.com",
        model: "gpt-4",
        profileName: "My GPT",
      })
    );
    expect(result.current.isFormValid).toBe(false);
  });

  it("isFormValid is false when errors exist", () => {
    const { result } = renderHook(() =>
      useModelForm({
        provider: "openai",
        apiKey: "sk-key",
        baseUrl: "https://api.openai.com",
        model: "gpt-4",
        profileName: "My GPT",
      })
    );
    act(() => {
      result.current.setErrors({ key: "Invalid" });
    });
    expect(result.current.isFormValid).toBe(false);
  });

  it("fetchModels sets error for invalid URL", async () => {
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      await result.current.fetchModels(
        "openai" as never,
        "sk-key",
        "not-a-url"
      );
    });
    expect(result.current.errors.url).toBe("InvalidUrl");
    expect(result.current.models).toEqual([]);
  });

  it("fetchModels does nothing for empty URL", async () => {
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      await result.current.fetchModels("openai" as never, "sk-key", "");
    });
    expect(mockGetProviderModels).not.toHaveBeenCalled();
  });

  it("fetchModels populates models on success", async () => {
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      await result.current.fetchModels(
        "openai" as never,
        "sk-key",
        "https://api.openai.com"
      );
    });
    expect(result.current.models).toHaveLength(2);
    expect(result.current.values.model).toBe("gpt-4");
    expect(result.current.values.profileName).toBe("OpenAI - GPT-4");
  });

  it("defaults to the first chat-capable model, skipping generation-only ones (Bug 83730)", async () => {
    mockGetProviderModels.mockResolvedValue([
      {
        id: "grok-imagine-video-1.5",
        name: "grok-imagine-video-1.5",
        provider: "xai",
        capabilities: 0x02, // Image
      },
      {
        id: "grok-4",
        name: "grok-4",
        provider: "xai",
        capabilities: 0x01, // Chat
      },
    ]);
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      await result.current.fetchModels(
        "xai" as never,
        "xai-key",
        "https://api.x.ai/v1"
      );
    });
    expect(result.current.values.model).toBe("grok-4");
  });

  it("falls back to the first model when none is chat-capable", async () => {
    mockGetProviderModels.mockResolvedValue([
      {
        id: "img-1",
        name: "img-1",
        provider: "xai",
        capabilities: 0x02,
      },
    ]);
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      await result.current.fetchModels(
        "xai" as never,
        "xai-key",
        "https://api.x.ai/v1"
      );
    });
    expect(result.current.values.model).toBe("img-1");
  });

  it("defaults to the model the picker lists first, not the first one the API returned", async () => {
    // OpenAI's /v1/models order is arbitrary; the picker sorts newest first.
    mockGetProviderModels.mockResolvedValue([
      {
        id: "gpt-5.4-2026-03-05",
        name: "gpt-5.4-2026-03-05",
        provider: "openai",
        capabilities: 0x01,
        created: 1_772_000_000,
      },
      {
        id: "gpt-image-2.5",
        name: "gpt-image-2.5",
        provider: "openai",
        capabilities: 0x02, // Image — newest, but not chat-capable
        created: 1_790_000_000,
      },
      {
        id: "gpt-6.1-sol",
        name: "gpt-6.1-sol",
        provider: "openai",
        capabilities: 0x01,
        created: 1_785_000_000,
      },
    ]);
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      await result.current.fetchModels(
        "openai" as never,
        "sk-key",
        "https://api.openai.com"
      );
    });
    expect(result.current.values.model).toBe("gpt-6.1-sol");
  });

  it("keeps a server-ranked catalogue's order when picking the default", async () => {
    mockGetProviderModels.mockResolvedValue([
      {
        id: "popular/model",
        name: "Popular",
        provider: "openrouter",
        capabilities: 0x01,
        created: 1_700_000_000,
      },
      {
        id: "newer/model",
        name: "Newer",
        provider: "openrouter",
        capabilities: 0x01,
        created: 1_790_000_000,
      },
    ]);
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      await result.current.fetchModels(
        "openrouter" as never,
        "or-key",
        "https://openrouter.ai/api/v1"
      );
    });
    expect(result.current.values.model).toBe("popular/model");
  });

  it("fetchModels yields empty model list when provider returns non-array", async () => {
    mockGetProviderModels.mockResolvedValue({ unexpected: true });
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      await result.current.fetchModels(
        "openai" as never,
        "sk-key",
        "https://api.openai.com"
      );
    });
    expect(result.current.models).toEqual([]);
  });

  it("fetchModels with keepModelIfExists keeps existing model", async () => {
    const { result } = renderHook(() =>
      useModelForm({
        ...initialValues,
        provider: "openai",
        model: "gpt-4",
        baseUrl: "https://api.openai.com",
      })
    );
    await act(async () => {
      await result.current.fetchModels(
        "openai" as never,
        "sk-key",
        "https://api.openai.com",
        { keepModelIfExists: true }
      );
    });
    expect(result.current.values.model).toBe("gpt-4");
  });

  it("fetchModels with isCloudProvider uses hostname as display name", async () => {
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      await result.current.fetchModels(
        "openai" as never,
        "sk-key",
        "https://cloud.example.com",
        { isCloudProvider: true }
      );
    });
    expect(result.current.values.profileName).toBe("cloud.example.com - GPT-4");
  });

  it("handleChange clears error for the changed field", () => {
    const { result } = renderHook(() => useModelForm(initialValues));
    act(() => {
      result.current.setErrors({ key: "Error", url: "Error2" });
    });
    act(() => {
      result.current.handleChange("apiKey", "new-key");
    });
    expect(result.current.errors.key).toBeUndefined();
    expect(result.current.errors.url).toBe("Error2");
  });

  it("handleChange for provider with cloud sets isCloudProvider", async () => {
    const { result } = renderHook(() => useModelForm(initialValues));
    await act(async () => {
      result.current.handleChange("provider", {
        type: "onlyoffice" as const,
        baseUrl: "https://cloud.example.com",
        apiKey: "ck-123",
        isCloudProvider: true,
      });
    });
    expect(result.current.values.isCloudProvider).toBe(true);
    expect(result.current.values.apiKey).toBe("ck-123");
  });
});
