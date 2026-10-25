import { useEffect } from 'react';

import { usePreferences } from '@/lib/preferences';
import { useTheme } from '@/theme/theme-provider';

/**
 * Pushes the stored preferences into the ThemeProvider once they load. Lives
 * inside the session gate, since there is nothing to load without one.
 *
 * Until then the provider runs on the device's cached copy, which is almost
 * always the same - so this usually changes nothing on screen.
 */
export function PreferencesSync() {
  const { data } = usePreferences();
  const { setTheme, setMode } = useTheme();

  useEffect(() => {
    if (!data) return;
    setTheme(data.theme);
    setMode(data.mode);
  }, [data, setTheme, setMode]);

  return null;
}
