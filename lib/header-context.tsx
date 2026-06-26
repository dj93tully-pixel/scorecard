// lib/header-context.tsx
// Lets pages inject content into the global app header (game name, back button,
// admin toggle) without each page rendering its own header bar.

"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface HeaderConfig {
  /** Secondary line under "WOLF" — e.g. the current game name. */
  title?: string;
  /** If set, show a back button on the right that navigates here. */
  backHref?: string;
  /** If set, show an Admin toggle button on the right. */
  admin?: { active: boolean; onToggle: () => void };
}

interface Ctx {
  config: HeaderConfig;
  setHeader: (c: HeaderConfig) => void;
}

const HeaderContext = createContext<Ctx | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HeaderConfig>({});
  const setHeader = useCallback((c: HeaderConfig) => setConfig(c), []);
  return (
    <HeaderContext.Provider value={{ config, setHeader }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error("useHeader must be used within HeaderProvider");
  return ctx;
}
