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

const JUNK_COLOR = "#F5C518"; // yellow — active side-bet fill
const JUNK_INK = "#1A1A1A"; // dark icon on the yellow fill (white is too low-contrast)

// ── Bet glyphs (solid, currentColor so they inherit theme/light-dark color) ────
type IconProps = { className?: string };
const svg = (children: React.ReactNode) => ({ className }: IconProps) => (
  <svg viewBox="0 0 100 100" className={className}>
    {children}
  </svg>
);

// Sandie — a sand castle: crenellated tower with a little flag.
const SandcastleIcon = svg(
  <>
    <path d="M18,80 Q34,73 50,75 Q66,77 82,80 L82,83 Q50,88 18,83 Z" fill="currentColor" />
    <path d="M28,78 L28,58 L72,58 L72,78 Z M45,78 L45,68 Q45,63 50,63 Q55,63 55,68 L55,78 Z" fill="currentColor" fillRule="evenodd" />
    <path d="M40,58 L40,40 L45,40 L45,44 L48,44 L48,40 L52,40 L52,44 L55,44 L55,40 L60,40 L60,58 Z" fill="currentColor" />
    <line x1="50" y1="42" x2="50" y2="24" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
    <path d="M50,24 L62,27 L50,30 Z" fill="currentColor" />
  </>
);

// Snake — a coiled body with a head and forked tongue.
const SnakeIcon = svg(
  <>
    <path d="M62,33 C46,36 48,52 62,56 C76,60 70,76 48,75 C40,74.5 37,70 38,66" fill="none" stroke="currentColor" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M55,26 a9,9 0 1,0 18,0 a9,9 0 1,0 -18,0 M65.2,24 a1.8,1.8 0 1,1 3.6,0 a1.8,1.8 0 1,1 -3.6,0" fill="currentColor" fillRule="evenodd" />
    <path d="M57,22 L48,17 M52,19.5 L48,17 L52,14" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </>
);

// Barkie — a pine tree.
const TreeIcon = svg(
  <>
    <path d="M45,76 L55,76 L55,86 L45,86 Z" fill="currentColor" />
    <path d="M50,20 L66,48 L58,48 L72,76 L28,76 L42,48 L34,48 Z" fill="currentColor" />
  </>
);

// Greenie / KP — a pin flag.
const FlagIcon = svg(
  <>
    <ellipse cx="50" cy="82" rx="16" ry="4" fill="currentColor" />
    <rect x="47.6" y="20" width="4.8" height="62" rx="2" fill="currentColor" />
    <path d="M50,20 L74,28 L50,36 Z" fill="currentColor" />
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
            style={active ? { background: JUNK_COLOR, borderColor: JUNK_COLOR, color: JUNK_INK } : undefined}
            className={`flex h-8 w-[19px] items-center justify-center rounded-lg border ${
              active ? "" : "border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Icon className="h-[15px] w-[15px]" />
          </button>
        );
      })}
    </div>
  );
}
