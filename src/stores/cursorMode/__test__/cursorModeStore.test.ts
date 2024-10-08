import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from "vitest";
import { CursorMode, useCursorModeStore } from '../useCursorModeStore';

describe('uiSettings Store', () => {
    it('uiSettingsStore - initial settings', async () => {
        // Expect the initial state to be an empty array
        const { result } = renderHook(() => useCursorModeStore());
        expect(result.current.cursorMode).toEqual('default');
    });

    it('uiSettingsStore - set to line', async () => {
        const { result } = renderHook(() => useCursorModeStore());

        const expectedMode = 'line';

        act(() => result.current.setCursorMode(expectedMode));
        expect(result.current.cursorMode).toEqual(expectedMode);
    });

    it('uiSettingsStore - set to line, then back to default', async () => {
        const { result } = renderHook(() => useCursorModeStore());

        let expectedMode = 'line' as CursorMode;
        act(() => result.current.setCursorMode(expectedMode));
        expect(result.current.cursorMode).toEqual(expectedMode);

        expectedMode = 'default' as CursorMode;
        act(() => result.current.setCursorMode(expectedMode));
        expect(result.current.cursorMode).toEqual(expectedMode);
    });

});
