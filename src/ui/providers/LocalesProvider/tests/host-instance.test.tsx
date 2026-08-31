// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
// The suite-wide setup stubs react-i18next with a key-echoing double;
// this test is about the real wiring, so opt out of that stub.
vi.unmock("react-i18next");

import { PlatformProvider } from "../../PlatformProvider/context";
import { I18nProvider, useI18n } from "../context";

// A host application's own i18next instance: its own namespaces, none of
// this library's keys, registered as react-i18next's default AND handed
// down through context — the shape every embedding app has.
const host = i18next.createInstance();

beforeAll(async () => {
  await host.use(initReactI18next).init({
    lng: "en-US",
    fallbackLng: "en",
    ns: ["Common"],
    defaultNS: "Common",
    resources: { "en-US": { Common: { Confirmation: "Confirmation" } } },
    // Hosts commonly switch suspense off, which turns a missing key into
    // silently rendered raw text instead of an error.
    react: { useSuspense: false },
  });
});

const Probe = () => {
  const { t } = useI18n();
  return <span data-testid="probe">{t("AIWouldLikeUseThisTool")}</span>;
};

describe("I18nProvider inside a host that owns react-i18next", () => {
  it("translates through its own instance, not the host's", async () => {
    render(
      <PlatformProvider platform={{} as never}>
        <I18nextProvider i18n={host}>
          <I18nProvider locale="en-US">
            <Probe />
          </I18nProvider>
        </I18nextProvider>
      </PlatformProvider>
    );

    await waitFor(
      () =>
        expect(screen.getByTestId("probe").textContent).toBe(
          "AI would like to use this tool:"
        ),
      { timeout: 5000 }
    );
  });
});
