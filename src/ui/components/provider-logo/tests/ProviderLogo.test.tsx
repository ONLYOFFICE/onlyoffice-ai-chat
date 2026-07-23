// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../../providers/ImagesProvider", () => ({
  useImages: () => ({
    getImageSrc: vi.fn(() => null),
    getIconComponent: vi.fn(() => null),
    getProviderImageSrc: (type: string) => `/img/${type}.png`,
  }),
}));

import { ProviderLogo } from "../index";

describe("ProviderLogo", () => {
  it("renders provider image", () => {
    render(<ProviderLogo providerType="openai" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/img/openai.png");
    expect(img).toHaveAttribute("alt", "model logo");
  });

  it("sizes the image via the logo image-size token", () => {
    render(<ProviderLogo providerType="anthropic" />);
    const img = screen.getByRole("img");
    expect(img).toHaveClass("w-[var(--model-card-logo-image-size)]");
    expect(img).toHaveClass("h-[var(--model-card-logo-image-size)]");
  });

  it("applies custom className", () => {
    const { container } = render(
      <ProviderLogo providerType="openai" className="extra" />
    );
    expect(container.firstElementChild).toHaveClass("extra");
  });
});
