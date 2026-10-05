// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { BoundedImage } from "../index";

const withNaturalSize = (img: HTMLImageElement, w: number, h: number) => {
  Object.defineProperty(img, "naturalWidth", { value: w, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: h, configurable: true });
};

describe("BoundedImage", () => {
  it("caps the height and the width until the picture has loaded", () => {
    const { getByTestId } = render(
      <BoundedImage
        src="data:image/png;base64,x"
        alt=""
        data-testid="img"
        maxHeightVar="--cap"
      />
    );
    const img = getByTestId("img") as HTMLImageElement;
    expect(img.style.maxHeight).toBe("var(--cap)");
    expect(img.style.maxWidth).toBe("");
    expect(img.className).toContain("max-w-full");
  });

  it("derives the width cap from the height cap and the picture's ratio", () => {
    const { getByTestId } = render(
      <BoundedImage
        src="data:image/png;base64,x"
        alt=""
        data-testid="img"
        maxHeightVar="--cap"
      />
    );
    const img = getByTestId("img") as HTMLImageElement;
    // A portrait page, 1236 × 1600.
    withNaturalSize(img, 1236, 1600);
    fireEvent.load(img);
    expect(img.style.maxWidth).toBe(
      `min(100%, calc(var(--cap) * ${1236 / 1600}))`
    );
    expect(img.style.maxHeight).toBe("var(--cap)");
  });

  it("ignores a load that reports no size", () => {
    const { getByTestId } = render(
      <BoundedImage src="x" alt="" data-testid="img" maxHeightVar="--cap" />
    );
    const img = getByTestId("img") as HTMLImageElement;
    withNaturalSize(img, 0, 0);
    fireEvent.load(img);
    expect(img.style.maxWidth).toBe("");
  });

  it("keeps the caller's classes and forwards onLoad", () => {
    let loaded = 0;
    const { getByTestId } = render(
      <BoundedImage
        src="x"
        alt=""
        data-testid="img"
        maxHeightVar="--cap"
        className="rounded-[8px]"
        onLoad={() => {
          loaded += 1;
        }}
      />
    );
    const img = getByTestId("img") as HTMLImageElement;
    fireEvent.load(img);
    expect(loaded).toBe(1);
    expect(img.className).toContain("rounded-[8px]");
  });
});
