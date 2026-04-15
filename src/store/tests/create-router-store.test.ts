import { describe, expect, it } from "vitest";
import { createRouterStore } from "../create-router-store";

describe("createRouterStore", () => {
  it("starts on chat page", () => {
    const store = createRouterStore();
    expect(store.getState().currentPage).toBe("chat");
  });

  describe("setCurrentPage", () => {
    it("navigates to settings", () => {
      const store = createRouterStore();
      store.getState().setCurrentPage("settings");
      expect(store.getState().currentPage).toBe("settings");
    });

    it("navigates to initial-setup", () => {
      const store = createRouterStore();
      store.getState().setCurrentPage("initial-setup");
      expect(store.getState().currentPage).toBe("initial-setup");
    });

    it("navigates to history", () => {
      const store = createRouterStore();
      store.getState().setCurrentPage("history");
      expect(store.getState().currentPage).toBe("history");
    });
  });

  describe("goToChat", () => {
    it("returns to chat page", () => {
      const store = createRouterStore();
      store.getState().setCurrentPage("settings");
      store.getState().goToChat();
      expect(store.getState().currentPage).toBe("chat");
    });
  });

  describe("goToSettings", () => {
    it("navigates to settings", () => {
      const store = createRouterStore();
      store.getState().goToSettings();
      expect(store.getState().currentPage).toBe("settings");
    });
  });

  describe("goToInitialSetup", () => {
    it("navigates to initial-setup", () => {
      const store = createRouterStore();
      store.getState().goToInitialSetup();
      expect(store.getState().currentPage).toBe("initial-setup");
    });
  });
});
