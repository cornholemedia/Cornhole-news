/** Stored theme. "system" follows prefers-color-scheme. No cookie is written. */
export const THEME_STORAGE_KEY = "cornhole.theme";

export const THEME_EVENT = "cornhole-theme-change";

export type ThemeChoice = "light" | "dark" | "system";

export function parseThemeChoice(value: string | null): ThemeChoice {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function themeIsDark(choice: ThemeChoice, prefersDark: boolean): boolean {
  return choice === "dark" || (choice === "system" && prefersDark);
}

/**
 * Blocking head script. Sets `class="dark"` and `data-theme` before first paint.
 * Reads localStorage and the system preference only. It must not read cookies
 * or request headers, or public pages would stop being cacheable.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var stored = localStorage.getItem(key);
    var theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = theme === "dark" || (theme === "system" && prefersDark);
    var root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`.trim();
