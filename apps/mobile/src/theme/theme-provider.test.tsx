import { act, render, renderHook } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { ReactNode } from 'react';

import { ThemeProvider, useTheme } from './theme-provider';

// @testing-library/react-native 14 renders and fires events asynchronously,
// so every call here is awaited.
function renderTheme() {
  return renderHook(() => useTheme(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider initialTheme="cocoa-plum" initialMode="light">
        {children}
      </ThemeProvider>
    ),
  });
}

describe('ThemeProvider', () => {
  it('starts on the given theme and mode', async () => {
    const { result } = await renderTheme();
    expect(result.current.theme).toBe('cocoa-plum');
    expect(result.current.mode).toBe('light');
    expect(result.current.resolvedMode).toBe('light');
    expect(result.current.palette.canvas).toBe('#faf4f0');
  });

  it('changes the palette without touching the mode', async () => {
    const { result } = await renderTheme();
    await act(() => result.current.setTheme('warm-ink'));
    expect(result.current.theme).toBe('warm-ink');
    expect(result.current.mode).toBe('light');
    expect(result.current.palette.canvas).toBe('#faf6f3');
  });

  it('changes the mode without touching the theme', async () => {
    const { result } = await renderTheme();
    await act(() => result.current.setMode('dark'));
    expect(result.current.mode).toBe('dark');
    expect(result.current.theme).toBe('cocoa-plum');
    expect(result.current.palette.canvas).toBe('#1a1316');
  });

  it('keeps both moving independently', async () => {
    const { result } = await renderTheme();
    await act(() => result.current.setTheme('warm-ink'));
    await act(() => result.current.setMode('dark'));
    expect(result.current.palette.canvas).toBe('#181311');
    await act(() => result.current.setMode('light'));
    expect(result.current.theme).toBe('warm-ink');
    expect(result.current.palette.canvas).toBe('#faf6f3');
  });

  it('follows the OS while the mode is `system`', async () => {
    const { result } = await renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ThemeProvider initialMode="system">{children}</ThemeProvider>
      ),
    });
    // jest-expo reports a light OS scheme, and `system` has to resolve, never
    // leak out as itself.
    expect(result.current.mode).toBe('system');
    expect(result.current.resolvedMode).toBe('light');
  });

  it('refuses to work outside the provider', async () => {
    // The hook throwing is the point; React still logs the error it caught.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Orphan() {
      useTheme();
      return <Text>unreachable</Text>;
    }
    await expect(render(<Orphan />)).rejects.toThrow(/ThemeProvider/);
    consoleError.mockRestore();
  });
});
