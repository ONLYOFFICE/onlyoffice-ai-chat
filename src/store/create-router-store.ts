import { create, type StoreApi, type UseBoundStore } from "zustand";

/**
 * Union of navigable page identifiers within the AI chat widget.
 */
export type Page = "chat" | "settings" | "initial-setup" | "history";

/**
 * Zustand state for in-widget page navigation.
 *
 * Provides the current page and convenience methods for navigating
 * between the chat view, settings panel, initial setup wizard, and
 * conversation history.
 */
export interface RouterStoreState {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  goToChat: () => void;
  goToSettings: () => void;
  goToInitialSetup: () => void;
}

export function createRouterStore(): UseBoundStore<StoreApi<RouterStoreState>> {
  return create<RouterStoreState>((set) => ({
    currentPage: "chat",
    setCurrentPage: (page) => set({ currentPage: page }),
    goToChat: () => set({ currentPage: "chat" }),
    goToSettings: () => set({ currentPage: "settings" }),
    goToInitialSetup: () => set({ currentPage: "initial-setup" }),
  }));
}
