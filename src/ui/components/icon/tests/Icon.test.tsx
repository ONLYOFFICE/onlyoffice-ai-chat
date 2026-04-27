// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedBeforeInjection: ((svg: any) => void) | null = null;

vi.mock("../../../providers/ImagesProvider", () => ({
  useImages: () => ({
    getImageSrc: vi.fn((name: string) => {
      if (name === "missing") return null;
      if (name === "raster") return { src: "/img/raster.png", isSvg: false };
      return { src: "/img/icon.svg", isSvg: true };
    }),
    getIconComponent: vi.fn(() => null),
    getProviderImageSrc: vi.fn(() => ""),
  }),
}));

vi.mock("react-svg", () => ({
  ReactSVG: ({
    src,
    className,
    style,
    beforeInjection,
  }: {
    src: string;
    className?: string;
    style?: React.CSSProperties;
    beforeInjection?: (svg: SVGSVGElement) => void;
  }) => {
    capturedBeforeInjection = beforeInjection ?? null;
    return (
      <div
        data-testid="react-svg"
        data-src={src}
        className={className}
        style={style}
      />
    );
  },
}));

vi.mock("../../../providers/ThemeProvider", () => ({
  useTheme: () => ({ themeType: "light", scale: 1 }),
}));

import { Icon } from "../index";

const createMockSvg = () => {
  const paths: { setAttribute: ReturnType<typeof vi.fn> }[] = [
    { setAttribute: vi.fn() },
    { setAttribute: vi.fn() },
  ];
  const circles: { setAttribute: ReturnType<typeof vi.fn> }[] = [
    { setAttribute: vi.fn() },
  ];
  return {
    querySelectorAll: (selector: string) => {
      if (selector === "path") return paths;
      if (selector === "circle") return circles;
      return [];
    },
    paths,
    circles,
  };
};

describe("Icon", () => {
  beforeEach(() => {
    capturedBeforeInjection = null;
  });

  it("renders SVG via ReactSVG", () => {
    render(<Icon name="test" size={24} />);
    const el = screen.getByTestId("react-svg");
    expect(el).toHaveAttribute("data-src", "/img/icon.svg");
    expect(el.style.width).toBe("24px");
    expect(el.style.height).toBe("24px");
  });

  it("renders raster image via img tag", () => {
    render(<Icon name="raster" size={20} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/img/raster.png");
    expect(img).toHaveAttribute("alt", "raster");
    expect(img.style.width).toBe("20px");
    expect(img.style.height).toBe("20px");
  });

  it("returns null when image is not found", () => {
    const { container } = render(<Icon name="missing" />);
    expect(container.firstChild).toBeNull();
  });

  it("uses width/height over size", () => {
    render(<Icon name="test" width={30} height={20} />);
    const el = screen.getByTestId("react-svg");
    expect(el.style.width).toBe("30px");
    expect(el.style.height).toBe("20px");
  });

  it("applies className to SVG", () => {
    render(<Icon name="test" className="custom-class" />);
    const el = screen.getByTestId("react-svg");
    expect(el.className).toContain("custom-class");
  });

  it("applies className to raster image", () => {
    render(<Icon name="raster" className="custom" />);
    expect(screen.getByRole("img")).toHaveClass("custom");
  });

  it("beforeInjection sets fill on paths and circles by default", () => {
    render(<Icon name="test" size={24} />);
    expect(capturedBeforeInjection).not.toBeNull();

    const mockSvg = createMockSvg();
    capturedBeforeInjection!(mockSvg as unknown as SVGSVGElement);

    mockSvg.paths.forEach((path) => {
      expect(path.setAttribute).toHaveBeenCalledWith(
        "fill",
        "var(--icon-button-color)"
      );
    });
    mockSvg.circles.forEach((circle) => {
      expect(circle.setAttribute).toHaveBeenCalledWith(
        "fill",
        "var(--icon-button-color)"
      );
    });
  });

  it("beforeInjection sets stroke when isStroke is true", () => {
    render(<Icon name="test" size={24} isStroke />);
    expect(capturedBeforeInjection).not.toBeNull();

    const mockSvg = createMockSvg();
    capturedBeforeInjection!(mockSvg as unknown as SVGSVGElement);

    mockSvg.paths.forEach((path) => {
      expect(path.setAttribute).toHaveBeenCalledWith(
        "stroke",
        "var(--icon-button-color)"
      );
    });
    mockSvg.circles.forEach((circle) => {
      expect(circle.setAttribute).toHaveBeenCalledWith(
        "stroke",
        "var(--icon-button-color)"
      );
    });
  });

  it("beforeInjection uses custom color prop", () => {
    render(<Icon name="test" size={24} color="red" />);
    expect(capturedBeforeInjection).not.toBeNull();

    const mockSvg = createMockSvg();
    capturedBeforeInjection!(mockSvg as unknown as SVGSVGElement);

    mockSvg.paths.forEach((path) => {
      expect(path.setAttribute).toHaveBeenCalledWith("fill", "red");
    });
    mockSvg.circles.forEach((circle) => {
      expect(circle.setAttribute).toHaveBeenCalledWith("fill", "red");
    });
  });

  it("beforeInjection with isStroke and custom color sets stroke with custom color", () => {
    render(<Icon name="test" size={24} isStroke color="#00ff00" />);
    expect(capturedBeforeInjection).not.toBeNull();

    const mockSvg = createMockSvg();
    capturedBeforeInjection!(mockSvg as unknown as SVGSVGElement);

    mockSvg.paths.forEach((path) => {
      expect(path.setAttribute).toHaveBeenCalledWith("stroke", "#00ff00");
    });
  });

  it("beforeInjection does nothing when noColor is true", () => {
    render(<Icon name="test" size={24} noColor />);
    expect(capturedBeforeInjection).not.toBeNull();

    const mockSvg = createMockSvg();
    capturedBeforeInjection!(mockSvg as unknown as SVGSVGElement);

    mockSvg.paths.forEach((path) => {
      expect(path.setAttribute).not.toHaveBeenCalled();
    });
    mockSvg.circles.forEach((circle) => {
      expect(circle.setAttribute).not.toHaveBeenCalled();
    });
  });

  it("renders with size only (width and height from size)", () => {
    render(<Icon name="test" size={16} />);
    const el = screen.getByTestId("react-svg");
    expect(el.style.width).toBe("16px");
    expect(el.style.height).toBe("16px");
  });

  it("renders without size, width or height", () => {
    render(<Icon name="test" />);
    const el = screen.getByTestId("react-svg");
    // width and height should be undefined
    expect(el.style.width).toBe("");
    expect(el.style.height).toBe("");
  });

  it("SVG className includes flex layout classes", () => {
    render(<Icon name="test" size={24} />);
    const el = screen.getByTestId("react-svg");
    expect(el.className).toContain("flex");
    expect(el.className).toContain("items-center");
    expect(el.className).toContain("justify-center");
  });

  it("SVG className without custom className does not have trailing space issues", () => {
    render(<Icon name="test" size={24} />);
    const el = screen.getByTestId("react-svg");
    expect(el.className).toContain("flex items-center justify-center");
  });
});
