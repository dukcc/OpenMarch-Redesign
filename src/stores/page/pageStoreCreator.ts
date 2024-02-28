import { type StateCreator } from "zustand";
import { Page } from "@/global/classes/Page";

export interface PageStoreInterface {
    /**
     * List of all pages sorted by order in the drill
     */
    pages: Page[],
    /**
     * Fetch the pages from the API and set them in the store
     * @returns A promise that resolves when the pages have been fetched
     */
    fetchPages: () => Promise<void>;
}

export const pageStoreCreator: StateCreator<PageStoreInterface> = (set) => ({
    pages: [],

    /**
     * Fetch the pages from the database and updates the store.
     * This is the only way to update retrieve the pages from the database that ensures the UI is updated.
     * To access the pages, use the `pages` property of the store.
     */
    fetchPages: async (): Promise<void> => {
        const newPages = await Page.getPages();
        set({
            pages: Page.sortPagesByOrder(newPages),
        });
    },
});
