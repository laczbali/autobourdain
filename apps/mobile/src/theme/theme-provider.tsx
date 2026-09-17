import { colorScheme } from 'nativewind';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';

import { paletteVars, palettes } from './palettes';
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
  /** Defaults, for tests and for rendering a fixed palette. */
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
 * Nothing persists yet. Settings and the stored preference are block 3; they
 * drive `setTheme`/`setMode` rather than replacing them.
 */
export function ThemeProvider({
  children,
  initialTheme = 'cocoa-plum',
  initialMode = 'system',
}: Props) {
  const [theme, setTheme] = useState<ThemeName>(initialTheme);
  const [mode, setMode] = useState<Mode>(initialMode);
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
