// lib/header-context.tsx
// Lets pages inject content into the global app header (game name, back button,
// admin toggle) without each page rendering its own header bar.

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface TickerData {
  /** Pulsing live dot when true. */
  live: boolean;
  /** Lead text, e.g. "Hole 7". */
  primary: string;
  /** Muted meta, e.g. "Wolf: Dan · Leader: Alice +$15". */
  meta?: string;
}

export interface HeaderButton {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  primary?: boolean;
}

export interface HeaderConfig {
  /** Secondary line under the brand wordmark — e.g. the current game name. */
  title?: string;
  /** If set, show a back button (dark "‹ Games") that navigates to this route. */
  backHref?: string;
  /** Like backHref, but runs a handler instead of navigating — for in-page views
   *  (e.g. the game editor lives as state on the home route, not its own URL). */
  backOnClick?: () => void;
  /** Generic right-side action (e.g. Admin / Edit / Done). */
  rightButton?: HeaderButton;
  /** If set, render a broadcast ticker strip beneath the header. */
  ticker?: TickerData | null;
  /** "admin" tints the header chrome (warm) + shows the title in amber, so it's
   *  obvious you're in the admin area rather than the play/games view. */
  variant?: "admin";
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
