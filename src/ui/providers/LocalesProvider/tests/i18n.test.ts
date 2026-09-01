import { afterEach, describe, expect, it } from "vitest";

import { initAIChatI18n, resetI18n } from "../i18n";

// Regression coverage for the init-time resources merge: host overrides for
// a locale must layer on top of the loaded bundle, not replace it (a
// single-key "en" override used to wipe the whole English bundle and every
// other key rendered as its raw name — DocSpace bugs 83450/83481/83491).
describe("initAIChatI18n resources merge", () => {
  afterEach(() => {
    resetI18n();
  });

  it("keeps the loaded bundle keys when a same-locale override is given", async () => {
    const i18n = await initAIChatI18n({
      locale: "en",
      resources: {
        en: { translation: { EnableWebSearch: "Enable it in billing" } },
      },
    });

    // The override applies...
    expect(i18n.t("EnableWebSearch")).toBe("Enable it in billing");
    // ...and the rest of the shipped bundle survives.
    expect(i18n.t("EditConfiguration")).toBe("Edit configuration");
  });

  it("keeps overrides for a locale that has no shipped bundle", async () => {
    const i18n = await initAIChatI18n({
      locale: "en",
      resources: {
        "x-custom": { translation: { EnableWebSearch: "custom" } },
      },
    });

    expect(
      i18n.getResource("x-custom", "translation", "EnableWebSearch"),
    ).toBe("custom");
  });
});
