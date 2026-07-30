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

// Sandie — a kids' sand shovel angled in a little mound of sand.
const SandcastleIcon = svg(
  <>
    <g transform="rotate(-24 50 54)">
      <rect x="37" y="16" width="26" height="8" rx="4" fill="currentColor" />
      <rect x="46.5" y="22" width="7" height="32" rx="3.5" fill="currentColor" />
      <path d="M39,54 L61,54 L59,68 Q50,77 41,68 Z" fill="currentColor" />
    </g>
    <path d="M18,78 Q34,70 50,72 Q66,74 82,78 L82,82 Q50,87 18,82 Z" fill="currentColor" opacity="0.5" />
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

// Birdie — a round bird. The head + eye are one even-odd path so the eye is a
// true knockout (a hole showing the background), never a hardcoded white fill.
const BirdieIcon = svg(
  <>
    <circle cx="46" cy="54" r="18" fill="currentColor" />
    <path
      d="M52,42 a9,9 0 1,0 18,0 a9,9 0 1,0 -18,0 M62.2,41 a1.8,1.8 0 1,0 3.6,0 a1.8,1.8 0 1,0 -3.6,0"
      fillRule="evenodd"
      fill="currentColor"
    />
    <path d="M68,40 L78,43 L68,46 Z" fill="currentColor" />
    <path d="M30,58 L15,61 L29,67 Z" fill="currentColor" />
    <line x1="44" y1="72" x2="44" y2="80" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <line x1="54" y1="72" x2="54" y2="80" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </>
);

// Eagle — a soaring eagle.
const EagleIcon = svg(
  <>
    <path d="M48,40 L14,32 C8,31 6,37 13,38 C7,40 9,46 16,44 C11,47 16,51 22,48 L46,46 Z" fill="currentColor" />
    <path d="M52,40 L86,32 C92,31 94,37 87,38 C93,40 91,46 84,44 C89,47 84,51 78,48 L54,46 Z" fill="currentColor" />
    <path d="M46,40 L54,40 L52,64 L48,64 Z" fill="currentColor" />
    <path d="M46,62 L42,76 L50,72 L58,76 L54,62 Z" fill="currentColor" />
    <circle cx="50" cy="34" r="6.5" fill="currentColor" />
    <path d="M50,25 L46,32 L54,32 Z" fill="currentColor" />
  </>
);

const JUNK_ICON: Record<string, (p: IconProps) => React.JSX.Element> = {
  birdie: BirdieIcon,
  eagle: EagleIcon,
  sandie: SandcastleIcon,
  snake: SnakeIcon,
  barkie: TreeIcon,
  greenie: FlagIcon,
};

/** Whether a junk bet id has a dedicated glyph (the manual bets do). */
export const hasJunkIcon = (id: string): boolean => id in JUNK_ICON;

/** The glyph for a junk bet id, or null if it has none (e.g. birdie/eagle). */
export function JunkIcon({ id, className }: { id: string; className?: string }) {
  const Icon = JUNK_ICON[id];
  return Icon ? <Icon className={className} /> : null;
}

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
