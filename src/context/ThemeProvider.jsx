import { useEffect, useState } from "react";
import { ThemeContext } from "./ThemeContext";

const STORAGE_KEY = "trusthome-theme";
const ACCESSIBILITY_STORAGE_KEY = "trusthome-accessibility";
const DEFAULT_ACCESSIBILITY = { largeText: false, highContrast: false, reduceMotion: false };

function readAccessibility() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY));
    return Object.fromEntries(Object.keys(DEFAULT_ACCESSIBILITY).map((key) => [key, saved?.[key] === true]));
  } catch {
    return DEFAULT_ACCESSIBILITY;
  }
}

/**
 * Reads the user's persisted preference from localStorage, falls back to
 * the OS preference, then applies "dark" or "light" class to <html> so
 * all CSS custom-property overrides activate automatically.
 */
export function ThemeProvider({ children }) {
  const [themePreference, setThemePreference] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return ["dark", "light", "system"].includes(saved) ? saved : "system";
  });
  const [systemTheme, setSystemTheme] = useState(() => (
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  ));
  const [accessibility, setAccessibility] = useState(readAccessibility);
  const theme = themePreference === "system" ? systemTheme : themePreference;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event) => setSystemTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, themePreference);
  }, [theme, themePreference]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("large-text", accessibility.largeText);
    root.classList.toggle("high-contrast", accessibility.highContrast);
    root.classList.toggle("reduce-motion", accessibility.reduceMotion);
    localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(accessibility));
  }, [accessibility]);

  function toggleTheme() {
    setThemePreference(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{
      theme,
      themePreference,
      setThemePreference,
      toggleTheme,
      accessibility,
      setAccessibility,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
