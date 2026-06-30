// components/PressDeck.tsx
// Player-scoped presses on the scores tab. A hole is a little deck: the front
// card has the scores; behind it (peeking, swipe to flip) sits one read-only
// PressCard per press showing who's in it and how they stand. Presses are
// created from the ⚡ buttons via PressPlayerPicker (default everyone).

"use client";

import { useRef, useState } from "react";
import { Zap, X } from "lucide-react";
import { Player } from "@/lib/wolf";
import { formatMoney } from "@/lib/storage";

const PRESS = "#E8590C"; // burnt orange

// Front (front nine), back, or full label for a press started on `hole`.
export function pressScopeLabel(hole: number, scope: "seg" | "full", sixes = false) {
  if (scope === "full") return "18";
  if (sixes) return hole <= 6 ? "F6" : hole <= 12 ? "M6" : "B6";
  return hole <= 9 ? "F9" : "B9";
}

// ── Player picker (shown when a ⚡ button is tapped; everyone preselected) ─────
export function PressPlayerPicker({
  players,
  scopeLabel,
  onAdd,
  onCancel,
}: {
  players: Player[];
  scopeLabel: string;
  onAdd: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(players.map((p) => p.id)));
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div className="mt-2 rounded-xl border-2 border-dashed p-2.5" style={{ borderColor: PRESS }}>
      <div className="mb-2 flex items-center gap-1 text-sm font-bold">
        <Zap className="h-[15px] w-[15px]" style={{ color: PRESS }} />
        New ⚡{scopeLabel} press — who&apos;s in?
      </div>
      <div className="flex flex-wrap gap-1.5">
        {players.map((p) => {
          const on = sel.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              style={on ? { background: PRESS, borderColor: PRESS } : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                on ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
              }`}
            >
              {(p.name || "?").split(" ")[0]}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onAdd([...sel])}
          disabled={sel.size < 2}
          className="rounded-lg px-3 py-1.5 text-sm font-bold text-on-dark disabled:opacity-40"
          style={{ background: PRESS }}
        >
          Add press
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-card-border px-3 py-1.5 text-sm font-semibold text-text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Read-only press outcome card (sits behind the hole in the deck) ───────────
export function PressCard({
  players,
  members,
  scopeLabel,
  holes,
  ledger,
  onRemove,
}: {
  players: Player[];
  members: string[];
  scopeLabel: string;
  holes: number[];
  ledger: Record<string, number>;
  onRemove: () => void;
}) {
  const name = (id: string) => players.find((p) => p.id === id)?.name || "?";
  const rows = [...members].sort((a, b) => (ledger[b] ?? 0) - (ledger[a] ?? 0));
  return (
    <div className="rounded-xl border-2 bg-card-bg p-3" style={{ borderColor: PRESS }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 font-bold" style={{ color: PRESS }}>
          <Zap className="h-[15px] w-[15px]" />⚡{scopeLabel} press
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove press"
          className="rounded-md p-1 text-text-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="text-xs text-text-muted">
        holes {holes[0]}–{holes[holes.length - 1]}
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((id) => {
          const m = ledger[id] ?? 0;
          return (
            <div key={id} className="flex items-center justify-between text-sm">
              <span className="truncate font-medium">{name(id)}</span>
              <span
                className="font-serif font-bold tabular-nums"
                style={{ color: m > 0 ? "#2BC081" : m < 0 ? "#F0524B" : "#8A90A0" }}
              >
                {formatMoney(m)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── The swipeable deck: front card + press cards peeking behind ───────────────
export function HoleDeck({
  front,
  cards,
}: {
  front: React.ReactNode;
  cards: React.ReactNode[];
}) {
  const [idx, setIdx] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  if (cards.length === 0) return <>{front}</>;
  const all = [front, ...cards];
  const active = Math.min(idx, all.length - 1);

  function onStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onEnd(e: React.TouchEvent) {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(t.clientY - s.y)) return;
    if (dx < 0) setIdx(Math.min(active + 1, all.length - 1)); // swipe left → next
    else setIdx(Math.max(active - 1, 0)); // swipe right → back
  }

  return (
    <div className="relative" onTouchStart={onStart} onTouchEnd={onEnd}>
      {all.map((card, i) => {
        const off = i - active;
        const behind = off > 0;
        const style: React.CSSProperties = {
          transition: "transform .25s ease, opacity .25s ease",
          transform:
            off === 0
              ? "none"
              : behind
                ? `translate(${Math.min(off, 3) * 8}px, ${Math.min(off, 3) * 6}px) scale(${1 - Math.min(off, 3) * 0.03})`
                : "translateX(-110%)",
          opacity: off < 0 ? 0 : 1,
          zIndex: 30 - Math.abs(off),
          pointerEvents: off === 0 ? "auto" : "none",
        };
        return off === 0 ? (
          <div key={i} className="relative" style={style}>
            {card}
          </div>
        ) : (
          <div key={i} className="absolute inset-0" style={style}>
            {card}
          </div>
        );
      })}
      {/* swipe hint / position dots */}
      <div className="mt-1 flex items-center justify-center gap-1">
        {all.map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: i === active ? PRESS : "#C4C8CE" }}
          />
        ))}
      </div>
    </div>
  );
}
