// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";

vi.unmock("../../LocalesProvider");
vi.unmock("../../LocalesProvider/context");

const { initAIChatI18n, loadLocale, i18nInstance } = vi.hoisted(() => ({
  initAIChatI18n: vi.fn().mockResolvedValue(undefined),
  loadLocale: vi.fn().mockResolvedValue(undefined),
  i18nInstance: {
    language: "en",
    on: vi.fn(),
    off: vi.fn(),
    changeLanguage: vi.fn(),
    addResourceBundle: vi.fn(),
  },
}));

vi.mock("../i18n", () => ({
  initAIChatI18n,
  loadLocale,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => `tr:${k}`,
    i18n: i18nInstance,
  }),
}));

vi.mock("i18next", () => ({
  default: i18nInstance,
}));

const { platformValue } = vi.hoisted(() => ({
  platformValue: {
    env: {
      locale: undefined as string | undefined,
      onEnvironmentChange: undefined as
        | ((cb: (info: { lang?: string }) => void) => () => void)
        | undefined,
    },
  },
}));

vi.mock("../../../platform/context", () => ({
  usePlatform: () => platformValue,
}));

vi.mock("../../../../shared/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { I18nProvider, useI18n } from "../context";

beforeEach(() => {
  initAIChatI18n.mockClear();
  initAIChatI18n.mockResolvedValue(undefined);
  loadLocale.mockClear();
  i18nInstance.on.mockClear();
  i18nInstance.off.mockClear();
  i18nInstance.changeLanguage.mockClear();
  i18nInstance.addResourceBundle.mockClear();
  i18nInstance.language = "en";
  platformValue.env.locale = undefined;
  platformValue.env.onEnvironmentChange = undefined;
});

describe("I18nProvider", () => {
  it("useI18n throws outside provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useI18n())).toThrow(
      "useI18n must be used within an I18nProvider"
    );
    errorSpy.mockRestore();
  });

  it("renders nothing while initializing then renders children", async () => {
    let resolveInit: () => void = () => {};
    initAIChatI18n.mockImplementation(
      () => new Promise<void>((r) => (resolveInit = r))
    );
    const { container, queryByText } = render(
      <I18nProvider>
        <span>child</span>
      </I18nProvider>
    );
    expect(container.innerHTML).toBe("");
    await act(async () => {
      resolveInit();
      await Promise.resolve();
    });
    await waitFor(() => expect(queryByText("child")).toBeInTheDocument());
  });

  it("init wires translations resources for the initial locale", async () => {
    render(
      <I18nProvider locale="ru" translations={{ AIAgent: "ИИ" } as never}>
        <span>x</span>
      </I18nProvider>
    );
    await waitFor(() => expect(initAIChatI18n).toHaveBeenCalled());
    expect(initAIChatI18n.mock.calls[0][0]).toEqual({
      locale: "ru",
      resources: { ru: { translation: { AIAgent: "ИИ" } } },
    });
  });

  it("init logs error and never readies on failure", async () => {
    initAIChatI18n.mockRejectedValueOnce(new Error("boom"));
    const { container } = render(
      <I18nProvider>
        <span>x</span>
      </I18nProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.innerHTML).toBe("");
  });

  it("calls loadLocale when locale prop changes after init", async () => {
    const { rerender, getByText } = render(
      <I18nProvider locale="en">
        <span>c</span>
      </I18nProvider>
    );
    await waitFor(() => expect(getByText("c")).toBeInTheDocument());
    loadLocale.mockClear();
    rerender(
      <I18nProvider locale="ru">
        <span>c</span>
      </I18nProvider>
    );
    await waitFor(() =>
      expect(loadLocale.mock.calls.some((call) => call[0] === "ru")).toBe(true)
    );
  });

  it("addResourceBundle is called when translations override changes", async () => {
    const { rerender, getByText } = render(
      <I18nProvider locale="en">
        <span>c</span>
      </I18nProvider>
    );
    await waitFor(() => expect(getByText("c")).toBeInTheDocument());
    rerender(
      <I18nProvider locale="en" translations={{ AIAgent: "Bot" } as never}>
        <span>c</span>
      </I18nProvider>
    );
    await waitFor(() =>
      expect(i18nInstance.addResourceBundle).toHaveBeenCalled()
    );
  });

  it("addResourceBundle is called for each customLanguage", async () => {
    const { getByText } = render(
      <I18nProvider
        customLanguages={
          {
            xx: { AIAgent: "Bot" },
            yy: { AIAgent: "Yot" },
          } as never
        }
      >
        <span>c</span>
      </I18nProvider>
    );
    await waitFor(() => expect(getByText("c")).toBeInTheDocument());
    expect(i18nInstance.addResourceBundle).toHaveBeenCalledWith(
      "xx",
      "translation",
      { AIAgent: "Bot" },
      true,
      true
    );
    expect(i18nInstance.addResourceBundle).toHaveBeenCalledWith(
      "yy",
      "translation",
      { AIAgent: "Yot" },
      true,
      true
    );
  });

  it("useI18n returns t/locale/direction for LTR locale", async () => {
    let captured: ReturnType<typeof useI18n> | undefined;
    const Probe = () => {
      captured = useI18n();
      return <span>p</span>;
    };
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    await waitFor(() => expect(captured).toBeDefined());
    expect(captured!.locale).toBe("en");
    expect(captured!.isRTL).toBe(false);
    expect(captured!.direction).toBe("ltr");
    expect(captured!.t("Hello" as never)).toBe("tr:Hello");
  });

  it("useI18n reflects RTL when language is ar-SA", async () => {
    i18nInstance.language = "ar-SA";
    let captured: ReturnType<typeof useI18n> | undefined;
    const Probe = () => {
      captured = useI18n();
      return <span />;
    };
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    await waitFor(() => expect(captured).toBeDefined());
    expect(captured!.isRTL).toBe(true);
    expect(captured!.direction).toBe("rtl");
  });

  it("changeLocale loads the requested locale", async () => {
    let captured: ReturnType<typeof useI18n> | undefined;
    const Probe = () => {
      captured = useI18n();
      return <span />;
    };
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    await waitFor(() => expect(captured).toBeDefined());
    loadLocale.mockClear();
    captured!.changeLocale("de");
    expect(loadLocale).toHaveBeenCalledWith("de");
  });

  it("subscribes/unsubscribes to react-i18next languageChanged", async () => {
    const { unmount, getByText } = render(
      <I18nProvider>
        <span>c</span>
      </I18nProvider>
    );
    await waitFor(() => expect(getByText("c")).toBeInTheDocument());
    expect(i18nInstance.on).toHaveBeenCalledWith(
      "languageChanged",
      expect.any(Function)
    );
    unmount();
    expect(i18nInstance.off).toHaveBeenCalledWith(
      "languageChanged",
      expect.any(Function)
    );
  });

  it("loadLocale is called when bridge sees a different prop locale", async () => {
    i18nInstance.language = "en";
    const { getByText } = render(
      <I18nProvider locale="fr">
        <span>c</span>
      </I18nProvider>
    );
    await waitFor(() => expect(getByText("c")).toBeInTheDocument());
    expect(loadLocale).toHaveBeenCalledWith("fr");
  });

  it("subscribes to platform.env.onEnvironmentChange and forwards lang", async () => {
    let cb: ((info: { lang?: string }) => void) | undefined;
    const unsubscribe = vi.fn();
    platformValue.env.onEnvironmentChange = vi.fn((handler) => {
      cb = handler;
      return unsubscribe;
    });
    const { unmount, getByText } = render(
      <I18nProvider>
        <span>c</span>
      </I18nProvider>
    );
    await waitFor(() => expect(getByText("c")).toBeInTheDocument());
    expect(cb).toBeDefined();
    loadLocale.mockClear();
    act(() => cb!({ lang: "de" }));
    expect(loadLocale).toHaveBeenCalledWith("de");
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("loads platform.env.locale on mount when present", async () => {
    platformValue.env.locale = "fr";
    const { getByText } = render(
      <I18nProvider>
        <span>c</span>
      </I18nProvider>
    );
    await waitFor(() => expect(getByText("c")).toBeInTheDocument());
    expect(loadLocale).toHaveBeenCalledWith("fr");
  });
});
