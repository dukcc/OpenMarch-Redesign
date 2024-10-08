import {
    render,
    fireEvent,
    renderHook,
    within,
    Matcher,
    MatcherOptions,
    ByRoleMatcher,
    ByRoleOptions,
    act,
} from "@testing-library/react";
import MarcherList from "../MarcherList";
import { mockMarchers } from "@/__mocks__/globalMocks";
import { useMarcherStore } from "@/stores/marcher/useMarcherStore";
import { Marcher } from "@/global/classes/Marcher";
import {
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    MockInstance,
    vi,
} from "vitest";
import { fail } from "assert";

describe("MarcherList", () => {
    function validateMarcherRows(
        marcherRows: HTMLElement[],
        expectedMarchers: Marcher[]
    ) {
        marcherRows.forEach((marcherRow) => {
            const marcherInRow = {
                drill_number: within(marcherRow).getByTitle(
                    "Marcher drill number"
                ).textContent,
                section:
                    within(marcherRow).getByTitle("Marcher section")
                        .textContent,
                name: within(marcherRow).getByTitle("Marcher name").textContent,
            };
            expect(expectedMarchers).toContainEqual(
                expect.objectContaining(marcherInRow)
            );
        });
    }

    let updateMarchersSpy: MockInstance;
    beforeAll(async () => {
        vi.mock("@/global/classes/Marcher");
        vi.mock("@/stores/marcher/useMarcherStore");

        // Mock the getMarchers function to return the mockMarchers array
        vi.spyOn(Marcher, "getMarchers").mockResolvedValue(mockMarchers);

        // Mock the updateMarchers function to return a resolved promise
        updateMarchersSpy = vi
            .spyOn(Marcher, "updateMarchers")
            .mockResolvedValue({ success: true });
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        const { result } = renderHook(() => useMarcherStore());
        await act(async () => {
            result.current.fetchMarchers();
        });
    });

    it("renders without errors", () => {
        render(<MarcherList />);
    });

    it("displays the correct number of marchers", () => {
        const { getAllByTestId } = render(<MarcherList />);
        expect(getAllByTestId("marcher row")).toHaveLength(mockMarchers.length);
    });

    it("displays the correct information for each marcher", () => {
        const { getAllByTestId } = render(<MarcherList />);
        const marcherRows = getAllByTestId("marcher row");
        validateMarcherRows(marcherRows, mockMarchers);
    });

    it("has header when hasHeader prop is true", () => {
        const { getByRole } = render(<MarcherList hasHeader={true} />);
        expect(getByRole("heading")).toBeDefined();
    });

    it("does not have header when hasHeader prop is false", () => {
        const { queryByRole } = render(<MarcherList hasHeader={false} />);
        expect(queryByRole("heading")).toBeNull();
    });

    describe("editing", () => {
        async function editMarcher(
            getByTitle: (
                id: Matcher,
                options?: MatcherOptions | undefined
            ) => HTMLElement,
            getAllByRole: (
                role: ByRoleMatcher,
                options?: ByRoleOptions | undefined
            ) => HTMLElement[],
            changes: {
                marcherId: number;
                newName?: string;
                newSection?: string;
                oldMarcher: Marcher;
            }[]
        ) {
            // Set the list to editing mode
            const editButton = getAllByRole("button", { name: /edit/i })[0];
            act(() => fireEvent.click(editButton));

            changes.forEach((change) => {
                // Make sure that the id for the change matches the old marcher
                expect(change.oldMarcher.id).toBe(change.marcherId);

                // Get the first row in the table
                const marcherRow = getByTitle(
                    `${change.oldMarcher.drill_number} marcher row`
                );
                if (!marcherRow) fail("No row found for marcher");

                if (change.newName) {
                    // validate that the marcher's old name is not the same as the new name (for testing purposes only, this is not a real requirement of the app)
                    expect(change.oldMarcher.name).not.toBe(change.newName);
                    // Type the new name into the input
                    const nameInput =
                        within(marcherRow).getByTitle("Marcher name input");
                    act(() =>
                        fireEvent.change(nameInput, {
                            target: { value: change.newName },
                        })
                    );
                }

                if (change.newSection) {
                    // validate that the marcher's old section is not the same as the new section (for testing purposes only, this is not a real requirement of the app)
                    expect(change.oldMarcher.section).not.toBe(
                        change.newSection
                    );
                    // Type the new section into the input
                    const sectionInput = within(marcherRow).getByTitle(
                        "Marcher section input"
                    );
                    act(() =>
                        fireEvent.change(sectionInput, {
                            target: { value: change.newSection },
                        })
                    );
                }
            });

            // Click the save button
            const saveButton = getAllByRole("button", { name: /save/i })[0];
            await act(async () => fireEvent.click(saveButton));

            // Validate that the updateMarchers function was called with the correct arguments
            const updateMarcherResults = updateMarchersSpy.mock.calls[0][0];
            expect(updateMarcherResults.length).toBe(changes.length);
            updateMarcherResults.forEach(
                (updateMarcherResult: {
                    id: number;
                    name: string;
                    section: string;
                }) => {
                    const correspondingChange = changes.find(
                        (change) => change.marcherId === updateMarcherResult.id
                    );
                    expect(correspondingChange).toBeDefined();
                    if (!correspondingChange)
                        fail("No corresponding change found for marcher id");
                    expect(updateMarcherResult.id).toBe(
                        correspondingChange?.marcherId
                    );
                    expect(updateMarcherResult.name).toBe(
                        correspondingChange.newName || undefined
                    );
                    expect(updateMarcherResult.section).toBe(
                        correspondingChange.newSection || undefined
                    );
                }
            );
        }

        it("edit a single marcher's name", async () => {
            const { getByTitle, getAllByRole } = render(<MarcherList />);
            const changes = [
                {
                    marcherId: 1,
                    newName: "Gordon Freeman",
                    oldMarcher: mockMarchers[0],
                },
            ];
            await editMarcher(getByTitle, getAllByRole, changes);
        });

        it("edit a single marcher's section", async () => {
            const { getByTitle, getAllByRole } = render(<MarcherList />);

            const changes = [
                {
                    marcherId: 1,
                    newSection: "Tuba",
                    oldMarcher: mockMarchers[0],
                },
            ];
            await editMarcher(getByTitle, getAllByRole, changes);
        });

        it("edit section and name for a single marcher", async () => {
            const { getByTitle, getAllByRole } = render(<MarcherList />);
            const changes = [
                {
                    marcherId: 1,
                    newName: "Gordon Freeman",
                    newSection: "Tuba",
                    oldMarcher: mockMarchers[0],
                },
            ];
            await editMarcher(getByTitle, getAllByRole, changes);
        });

        it("edit the section and name for multiple marchers", async () => {
            const { getByTitle, getAllByRole } = render(<MarcherList />);
            const changes = [
                {
                    marcherId: 1,
                    newName: "Ross Geller",
                    newSection: "Snare",
                    oldMarcher: mockMarchers.find(
                        (marcher) => marcher.id === 1
                    )!,
                },
                {
                    marcherId: 2,
                    newName: "Joey Tribbiani",
                    newSection: "Rifle",
                    oldMarcher: mockMarchers.find(
                        (marcher) => marcher.id === 2
                    )!,
                },
                {
                    marcherId: 3,
                    newName: "Chandler Bing",
                    newSection: "Alto Sax",
                    oldMarcher: mockMarchers.find(
                        (marcher) => marcher.id === 3
                    )!,
                },
            ];
            await editMarcher(getByTitle, getAllByRole, changes);
        });
    });
});
