import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  applyTheme,
  DEFAULT_THEME,
  isSupportedTheme,
  readStoredTheme,
  themes,
  THEME_STORAGE_KEY,
} from "./themes.js";
import { ThemeContext } from "./useTheme.js";

function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => readStoredTheme());

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    const safeTheme = isSupportedTheme(nextTheme) ? nextTheme : DEFAULT_THEME;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
    applyTheme(safeTheme);
    setThemeState(safeTheme);
  }, []);

  const value = useMemo(() => ({
    theme,
    themeDefinition: themes[theme],
    availableThemes: themes,
    setTheme,
  }), [setTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
