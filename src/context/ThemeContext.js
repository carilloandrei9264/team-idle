import { createContext } from "react";

/**
 * ThemeContext exposes { theme, toggleTheme }.
 * theme is "light" | "dark".
 * Consumed via useTheme() hook in useTheme.js.
 */
export const ThemeContext = createContext({
  theme: "light",
  themePreference: "system",
  setThemePreference: () => {},
  accentPreference: "blue",
  setAccentPreference: () => {},
  toggleTheme: () => {},
  accessibility: { largeText: false, highContrast: false, reduceMotion: false },
  setAccessibility: () => {},
});
