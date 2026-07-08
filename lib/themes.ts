// lib/themes.ts
// The theme registry — the single place that lists selectable themes. Each
// theme's actual palette lives in a matching `[data-theme="<id>"]` block in
// app/globals.css. To add a theme: add one CSS block there + one entry here.
// Presentation only — themes swap colors (and the card corner radius), never
// any game/scoring behavior.

export interface ThemeDef {
  /** Value stored in localStorage and set as <html data-theme>. */
  id: string;
  /** Label shown in the header theme dropdown. */
  label: string;
}

export const THEMES: ThemeDef[] = [
  { id: "default", label: "Default" },
  { id: "fintech", label: "Fresh Fintech" },
];

export const DEFAULT_THEME_ID = "default";
export const THEME_STORAGE_KEY = "ht-theme";

/** Normalize an arbitrary stored value to a known theme id (fallback: default). */
export function normalizeThemeId(value: string | null | undefined): string {
  return THEMES.some((t) => t.id === value) ? (value as string) : DEFAULT_THEME_ID;
}
