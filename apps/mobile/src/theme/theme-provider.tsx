import { DEFAULT_PREFERENCES } from '@autobourdain/shared';
import { colorScheme } from 'nativewind';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';

import { paletteVars, palettes } from './palettes';
import { readCachedAppearance, writeCachedAppearance } from './preference-cache';
import type { Mode, Palette, ResolvedMode, ThemeName } from './tokens';

type ThemeContextValue = {
  /** Which palette. Independent of the mode. */
  theme: ThemeName;
  /** What the user picked, `system` included. */
  mode: Mode;
  /** What `mode` currently comes out as. Never `system`. */
  resolvedMode: ResolvedMode;
  /**
   * The resolved colours as hex, for the places that take a colour prop rather
   * than a className - ActivityIndicator, navigation headers, the status bar.
   * A className is the better answer wherever one is accepted.
   */
  palette: Palette;
  setTheme: (theme: ThemeName) => void;
  setMode: (mode: Mode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}

type Props = {
  children: ReactNode;
  /**
   * Fixed starting values, for tests and for rendering a set palette. Left out,
   * the provider starts from this device's cached appearance, then the
   * defaults.
   */
  initialTheme?: ThemeName;
  initialMode?: Mode;
};

/**
 * Holds the two axes and injects the matching palette.
 *
 * They stay independent on purpose: `mode` picks light or dark, `theme` picks
 * the palette, and setting one never touches the other. The colours arrive as
 * CSS variables on this View through NativeWind's `vars()`, which works the
 * same on web and native - Tailwind's own `dark:` variant could only carry one
 * of the two axes, and only in a stylesheet.
 *
 * The stored preference lives on the server and arrives late, after the
 * session. So the provider starts from a copy cached on the device, read
 * synchronously, and keeps that copy current - which is what stops the first
 * paint from flashing the default palette. The server's value is pushed in
 * through `setTheme`/`setMode` once it loads.
 */
export function ThemeProvider({ children, initialTheme, initialMode }: Props) {
  // Read once, on the first render only.
  const [cached] = useState(readCachedAppearance);
  const [theme, setTheme] = useState<ThemeName>(
    initialTheme ?? cached?.theme ?? DEFAULT_PREFERENCES.theme,
  );
  const [mode, setMode] = useState<Mode>(initialMode ?? cached?.mode ?? DEFAULT_PREFERENCES.mode);
  const systemScheme = useColorScheme();

  const resolvedMode: ResolvedMode =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  // Tailwind runs in darkMode: 'class', so nothing picks the scheme up on its
  // own - it has to be pushed into NativeWind. The colours here come from
  // vars() rather than `dark:`, but this still drives `dark:` for anything
  // else, plus the React Native components that read the scheme directly.
  useEffect(() => {
    colorScheme.set(resolvedMode);
  }, [resolvedMode]);

  // Kept on sign-out too, so the sign-in screen stays in the last palette.
  useEffect(() => {
    writeCachedAppearance({ theme, mode });
  }, [theme, mode]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      resolvedMode,
      palette: palettes[theme][resolvedMode],
      setTheme,
      setMode,
    }),
    [theme, mode, resolvedMode],
  );

  return (
    <ThemeContext value={value}>
      <View className="flex-1 bg-canvas" style={paletteVars[theme][resolvedMode]}>
        {children}
      </View>
    </ThemeContext>
  );
}
