"use client";

import { useId, useLayoutEffect, useState } from "react";
import {
  THEME_EVENT,
  THEME_STORAGE_KEY,
  parseThemeChoice,
  themeIsDark,
  type ThemeChoice,
} from "@/lib/theme";

function applyTheme(choice: ThemeChoice) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = themeIsDark(choice, prefersDark);
  const root = document.documentElement;
  root.setAttribute("data-theme", choice);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

function readChoice(): ThemeChoice {
  try {
    return parseThemeChoice(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export default function ThemeToggle({ labelled = false }: { labelled?: boolean }) {
  const id = useId();
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function sync() {
      const next = readChoice();
      setChoice(next);
      applyTheme(next);
    }

    sync();
    media.addEventListener("change", sync);
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function onChange(value: string) {
    const next = parseThemeChoice(value);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode can block storage. The choice still applies for this view.
    }
    setChoice(next);
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <div className={labelled ? "inline-flex items-center gap-2" : "inline-flex"}>
      {labelled ? (
        <label htmlFor={id} className="text-sm font-medium">
          Theme
        </label>
      ) : null}
      <select
        id={id}
        aria-label={labelled ? undefined : "Color theme"}
        className="theme-choice"
        value={choice}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
