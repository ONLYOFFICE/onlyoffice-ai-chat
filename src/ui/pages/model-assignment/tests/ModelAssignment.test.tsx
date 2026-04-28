// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockSetDefaultProfile = vi.fn();
const mockSetChatProfile = vi.fn();
const mockSetSummarizationProfile = vi.fn();
const mockSetTranslationProfile = vi.fn();
const mockSetTextAnalysisProfile = vi.fn();
const mockSetImageGenerationProfile = vi.fn();
const mockSetOcrProfile = vi.fn();
const mockSetVisionProfile = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../store/context", () => ({
  useStores: () => ({
    useProfilesStore: () => ({
      profiles: [
        { id: "p1", name: "GPT-4", capabilities: 0x01 },
        { id: "p2", name: "DALL-E", capabilities: 0x02 },
        { id: "p3", name: "Vision Model", capabilities: 0x80 },
        { id: "p4", name: "All Caps", capabilities: undefined },
      ],
      defaultProfile: { id: "p1", name: "GPT-4" },
      chatProfile: null,
      summarizationProfile: null,
      translationProfile: null,
      textAnalysisProfile: null,
      imageGenerationProfile: { id: "p2", name: "DALL-E" },
      ocrProfile: null,
      visionProfile: null,
      setDefaultProfile: mockSetDefaultProfile,
      setChatProfile: mockSetChatProfile,
      setSummarizationProfile: mockSetSummarizationProfile,
      setTranslationProfile: mockSetTranslationProfile,
      setTextAnalysisProfile: mockSetTextAnalysisProfile,
      setImageGenerationProfile: mockSetImageGenerationProfile,
      setOcrProfile: mockSetOcrProfile,
      setVisionProfile: mockSetVisionProfile,
    }),
  }),
}));

vi.mock("../../../../capabilities", () => ({
  CapabilitiesUI: {
    None: 0x00,
    Chat: 0x01,
    Image: 0x02,
    Vision: 0x80,
    Tools: 0x100,
  },
}));

vi.mock("../../../components/combo-box", () => ({
  ComboBox: ({
    value,
    placeholder,
    items,
  }: {
    value: string;
    placeholder?: string;
    items: { text: string; id: string; onClick: () => void }[];
  }) => (
    <div
      data-testid="combo-box"
      data-value={value}
      data-placeholder={placeholder}
    >
      {value || placeholder}
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
  ),
}));

vi.mock("../../../components/field-container", () => ({
  FieldContainer: ({
    children,
    header,
    icon,
  }: {
    children: React.ReactNode;
    header: string;
    icon?: string;
  }) => (
    <div data-testid={`field-${header}`} data-icon={icon}>
      <label>{header}</label>
      {children}
    </div>
  ),
}));

import { ModelAssignment } from "../sub-components";

describe("ModelAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders description text", () => {
    render(<ModelAssignment />);
    expect(screen.getByText("ModelAssignmentDescription")).toBeInTheDocument();
  });

  it("renders default model selector with current profile name", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-DefaultModel");
    expect(field).toBeInTheDocument();
    expect(field.querySelector("[data-value='GPT-4']")).toBeInTheDocument();
  });

  it("renders override for tasks header", () => {
    render(<ModelAssignment />);
    expect(screen.getByText("OverrideForTasks")).toBeInTheDocument();
  });

  it("renders all 7 task fields", () => {
    render(<ModelAssignment />);
    expect(screen.getByTestId("field-AIChat")).toBeInTheDocument();
    expect(screen.getByTestId("field-Summarization")).toBeInTheDocument();
    expect(screen.getByTestId("field-Translation")).toBeInTheDocument();
    expect(screen.getByTestId("field-TextAnalysis")).toBeInTheDocument();
    expect(screen.getByTestId("field-ImageGeneration")).toBeInTheDocument();
    expect(screen.getByTestId("field-OCR")).toBeInTheDocument();
    expect(screen.getByTestId("field-Vision")).toBeInTheDocument();
  });

  it("shows DefaultModel as value for task fields when no override is set", () => {
    render(<ModelAssignment />);
    const chatField = screen.getByTestId("field-AIChat");
    expect(
      chatField.querySelector("[data-value='DefaultModel']")
    ).toBeInTheDocument();
  });

  it("shows profile name for task fields with an override", () => {
    render(<ModelAssignment />);
    const imgField = screen.getByTestId("field-ImageGeneration");
    expect(imgField.querySelector("[data-value='DALL-E']")).toBeInTheDocument();
  });

  it("task fields have correct icons", () => {
    render(<ModelAssignment />);
    expect(screen.getByTestId("field-AIChat")).toHaveAttribute(
      "data-icon",
      "ask-ai"
    );
    expect(screen.getByTestId("field-Summarization")).toHaveAttribute(
      "data-icon",
      "summarization"
    );
    expect(screen.getByTestId("field-Translation")).toHaveAttribute(
      "data-icon",
      "translation"
    );
    expect(screen.getByTestId("field-TextAnalysis")).toHaveAttribute(
      "data-icon",
      "text-analysis-ai"
    );
    expect(screen.getByTestId("field-ImageGeneration")).toHaveAttribute(
      "data-icon",
      "image-generation"
    );
    expect(screen.getByTestId("field-OCR")).toHaveAttribute("data-icon", "ocr");
    expect(screen.getByTestId("field-Vision")).toHaveAttribute(
      "data-icon",
      "vision-ai"
    );
  });

  it("calls setDefaultProfile when a default model is selected", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-DefaultModel");
    const btn = field.querySelector("[data-testid='combo-item-p1']");
    fireEvent.click(btn!);
    expect(mockSetDefaultProfile).toHaveBeenCalledWith({
      id: "p1",
      name: "GPT-4",
      capabilities: 0x01,
    });
  });

  it("calls setChatProfile with null when DefaultModel is chosen", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-AIChat");
    const btn = field.querySelector("[data-testid='combo-item-default']");
    fireEvent.click(btn!);
    expect(mockSetChatProfile).toHaveBeenCalledWith(null);
  });

  it("calls setChatProfile with a profile when selected", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-AIChat");
    const btn = field.querySelector("[data-testid='combo-item-p1']");
    fireEvent.click(btn!);
    expect(mockSetChatProfile).toHaveBeenCalledWith({
      id: "p1",
      name: "GPT-4",
      capabilities: 0x01,
    });
  });

  it("calls setSummarizationProfile when selected", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-Summarization");
    const btn = field.querySelector("[data-testid='combo-item-p1']");
    fireEvent.click(btn!);
    expect(mockSetSummarizationProfile).toHaveBeenCalledWith({
      id: "p1",
      name: "GPT-4",
      capabilities: 0x01,
    });
  });

  it("calls setTranslationProfile when selected", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-Translation");
    const btn = field.querySelector("[data-testid='combo-item-p1']");
    fireEvent.click(btn!);
    expect(mockSetTranslationProfile).toHaveBeenCalledWith({
      id: "p1",
      name: "GPT-4",
      capabilities: 0x01,
    });
  });

  it("calls setTextAnalysisProfile when selected", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-TextAnalysis");
    const btn = field.querySelector("[data-testid='combo-item-p1']");
    fireEvent.click(btn!);
    expect(mockSetTextAnalysisProfile).toHaveBeenCalledWith({
      id: "p1",
      name: "GPT-4",
      capabilities: 0x01,
    });
  });

  it("calls setImageGenerationProfile when selected", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-ImageGeneration");
    const btn = field.querySelector("[data-testid='combo-item-p2']");
    fireEvent.click(btn!);
    expect(mockSetImageGenerationProfile).toHaveBeenCalledWith({
      id: "p2",
      name: "DALL-E",
      capabilities: 0x02,
    });
  });

  it("calls setOcrProfile when selected", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-OCR");
    const btn = field.querySelector("[data-testid='combo-item-p3']");
    fireEvent.click(btn!);
    expect(mockSetOcrProfile).toHaveBeenCalledWith({
      id: "p3",
      name: "Vision Model",
      capabilities: 0x80,
    });
  });

  it("calls setVisionProfile when selected", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-Vision");
    const btn = field.querySelector("[data-testid='combo-item-p3']");
    fireEvent.click(btn!);
    expect(mockSetVisionProfile).toHaveBeenCalledWith({
      id: "p3",
      name: "Vision Model",
      capabilities: 0x80,
    });
  });

  it("filters profiles by Chat capability for chat-related tasks", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-AIChat");
    // GPT-4 (0x01 Chat) should be present, DALL-E (0x02 Image) should NOT
    // All Caps (undefined) should be present (no capabilities = show all)
    expect(
      field.querySelector("[data-testid='combo-item-p1']")
    ).toBeInTheDocument();
    expect(
      field.querySelector("[data-testid='combo-item-p4']")
    ).toBeInTheDocument();
    expect(
      field.querySelector("[data-testid='combo-item-p2']")
    ).not.toBeInTheDocument();
  });

  it("filters profiles by Image capability for image generation", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-ImageGeneration");
    // DALL-E (0x02 Image) should be present, GPT-4 (0x01 Chat) should NOT
    expect(
      field.querySelector("[data-testid='combo-item-p2']")
    ).toBeInTheDocument();
    expect(
      field.querySelector("[data-testid='combo-item-p1']")
    ).not.toBeInTheDocument();
  });

  it("filters profiles by Vision capability for OCR and Vision", () => {
    render(<ModelAssignment />);
    const ocrField = screen.getByTestId("field-OCR");
    expect(
      ocrField.querySelector("[data-testid='combo-item-p3']")
    ).toBeInTheDocument();
    expect(
      ocrField.querySelector("[data-testid='combo-item-p1']")
    ).not.toBeInTheDocument();

    const visionField = screen.getByTestId("field-Vision");
    expect(
      visionField.querySelector("[data-testid='combo-item-p3']")
    ).toBeInTheDocument();
  });

  it("includes DefaultModel option in all task dropdowns", () => {
    render(<ModelAssignment />);
    const fields = [
      "field-AIChat",
      "field-Summarization",
      "field-Translation",
      "field-TextAnalysis",
      "field-ImageGeneration",
      "field-OCR",
      "field-Vision",
    ];
    for (const fieldId of fields) {
      const field = screen.getByTestId(fieldId);
      expect(
        field.querySelector("[data-testid='combo-item-default']")
      ).toBeInTheDocument();
    }
  });

  it("default model dropdown contains all profiles", () => {
    render(<ModelAssignment />);
    const field = screen.getByTestId("field-DefaultModel");
    expect(
      field.querySelector("[data-testid='combo-item-p1']")
    ).toBeInTheDocument();
    expect(
      field.querySelector("[data-testid='combo-item-p2']")
    ).toBeInTheDocument();
    expect(
      field.querySelector("[data-testid='combo-item-p3']")
    ).toBeInTheDocument();
    expect(
      field.querySelector("[data-testid='combo-item-p4']")
    ).toBeInTheDocument();
  });
});
