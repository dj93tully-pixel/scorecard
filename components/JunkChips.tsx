// components/JunkChips.tsx
// Per-player side-bet ("junk") toggles, shown inline to the right of a player's
// score on the score tabs. One small icon per enabled MANUAL bet eligible on the
// hole (greenies only on par 3s); tapping toggles that player's flag. Greenies
// are single-winner (tapping one clears the others); sandies/barkies/snakes allow
// several. Auto bets (birdies/eagles) score off the card and never appear here.
// Capture only — money lives in lib/junk.ts and the Cards tab.

"use client";

import { Round, HoleEntry, PlayerId } from "@/lib/wolf";
import { manualJunkForHole, toggleJunkFlag } from "@/lib/junk";

const JUNK_COLOR = "#0FA968"; // money-green, distinct from press/hammer/forfeit

// ── Hand-drawn bet glyphs (lucide-style: stroke currentColor, no fill) ─────────
type IconProps = { className?: string };
const svg = (children: React.ReactNode) => ({ className }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

// Sandie — a sand castle: crenellated tower with a little flag.
const SandcastleIcon = svg(
  <>
    <path d="M7 21V13M17 21V13M7 21H17" />
    <path d="M7 13V11H9V13H11V11H13V13H15V11H17V13" />
    <path d="M12 11V7L15 8.2 12 9.4" />
  </>
);

// Snake — a wavy body with a forked tongue.
const SnakeIcon = svg(
  <>
    <path d="M4 14q3-4 6 0t6 0h2l1.5-1M18 14l1.5 1" />
    <circle cx="15" cy="13" r="0.6" fill="currentColor" stroke="none" />
  </>
);

// Barkie — a pine tree.
const TreeIcon = svg(
  <>
    <path d="M12 4 8.5 10H15.5Z" />
    <path d="M12 8 6 16H18Z" />
    <path d="M12 16V20" />
  </>
);

// Greenie / KP — a pin flag.
const FlagIcon = svg(
  <>
    <path d="M6 3V21" />
    <path d="M6 4H16L13 7 16 10H6" />
  </>
);

const JUNK_ICON: Record<string, (p: IconProps) => React.JSX.Element> = {
  sandie: SandcastleIcon,
  snake: SnakeIcon,
  barkie: TreeIcon,
  greenie: FlagIcon,
};

export function PlayerJunkIcons({
  round,
  hole,
  playerId,
  entry,
  onChange,
}: {
  round: Round;
  hole: number;
  playerId: PlayerId;
  entry?: HoleEntry;
  onChange: (junk: Record<PlayerId, string[]>) => void;
}) {
  const par = round.course.holes.find((h) => h.number === hole)?.par ?? null;
  const bets = manualJunkForHole(round.settings, par);
  if (bets.length === 0) return null;

  const ids = round.players.map((p) => p.id);
  const junkMap = entry?.junk ?? {};

  return (
    <div className="flex shrink-0 items-center gap-1">
      {bets.map((bet) => {
        const single = bet.settle === "carry"; // one greenie winner per hole
        const active = (junkMap[playerId] ?? []).includes(bet.id);
        const Icon = JUNK_ICON[bet.id] ?? FlagIcon;
        return (
          <button
            key={bet.id}
            onClick={() => onChange(toggleJunkFlag(junkMap, ids, bet.id, playerId, single))}
            aria-label={bet.label}
            aria-pressed={active}
            title={bet.label}
            style={active ? { background: JUNK_COLOR, borderColor: JUNK_COLOR } : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              active ? "text-on-dark" : "border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Icon className="h-[15px] w-[15px]" />
          </button>
        );
      })}
    </div>
  );
}
