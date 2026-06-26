# 🐺 Wolf

A mobile-first golf **scorecard + Wolf money-game tracker**. Built to be used
one-handed on a phone, on the course. Scores, handicap pops, and the live money
ledger are all computed by a pure engine and persisted locally.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (Postgres + Realtime) as a shared games database — no login. Anyone
  with the link can create / open / edit / delete games, and edits sync live via
  Supabase Realtime. Access is gated by the link being private + permissive RLS.
- A thin server proxy for course lookups (keeps the course-API key off the browser).

### Pages

- `/` — home: list of games, create a new game, delete a game.
- `/game/[id]` — a game: **Scores** and **Card** tabs, plus an **Admin** panel
  (Setup) anyone can open to edit players / course / rules.

### Environment

Copy `.env.example` → `.env.local` and fill in:

- `GOLF_COURSE_API_KEY` — server-only, for course import (optional).
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the Supabase
  project URL + publishable key. These are browser-safe public values.

On Vercel, add the same three as environment variables.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # run the engine unit tests (Vitest)
npm run build        # production build
```

## The engine (`lib/wolf.ts`)

A pure, framework-agnostic module — **no React imports, ever**. It owns all the math:

- **Pops (handicap strokes).** `offLow` (match-play convention: strokes off the
  lowest handicap in the group) or `full` (each player's full allotment).
  Supports double-pops for >18 strokes received.
- **Money model.** Each hole: `teamA` = wolf (+ partner if 2v2), `teamB` = the
  field. Best **net** ball per team decides the hole. 2v2 splits the stake;
  lone/blind play the wolf head-to-head against each opponent at a multiplier.
- **Ledger invariant.** Every hole's money deltas sum to exactly `0`, and the
  running ledger always sums to `0`. This is asserted in the tests.
- **Carryover.** Optional — a pushed stake rolls into the next decided hole.

UI code consumes these pure functions and must never reimplement the math.

### Tests

```bash
npm test
```

Covers: offLow pops (incl. >18 double-pops), full mode, 2v2 win/loss/push,
carryover, lone & blind wolf, and a full 18-hole round whose ledger sums to 0.

## Course import (optional)

Two ways to build a scorecard: **manual** (edit par + stroke index per hole) or
**import** from [golfcourseapi.com](https://golfcourseapi.com).

The API key is read **server-side only** from `GOLF_COURSE_API_KEY` and never
reaches the browser. The client talks only to the internal routes:

- `app/api/courses/search/route.ts`
- `app/api/courses/[id]/route.ts`

To enable import:

1. Copy `.env.example` → `.env.local`
2. Paste your key into `GOLF_COURSE_API_KEY=`
3. Restart `npm run dev`

`.env.local` is gitignored and will never be committed.

> Note: the upstream auth header is `Authorization: Key <API_KEY>`. If lookups
> return `401`, verify the header prefix against the
> [API docs](https://api.golfcourseapi.com/docs/api/). The `/courses/:id`
> handler logs the raw response shape once so field mappings can be confirmed.

## How to play a round

1. **Setup** — add 3–5 players (name + handicap), set the stake/rules, order the
   tees, and build or import the course.
2. **Play** — go hole by hole. The wolf is prefilled by tee rotation (override
   anytime for the "last place is wolf" variant). The wolf picks a partner, or
   goes **Lone**/**Blind**. Enter gross scores; net is computed via pops.
3. **Card** — full scorecard with pops dots.
4. **Ledger** — live standings: who's up, who's down, by how much.

## Theme

"NBC" SMU blue/red palette defined as Tailwind tokens in `tailwind.config.ts`
(and CSS vars in `app/globals.css`). The wolf mark is an inline SVG in
`components/WolfLogo.tsx` — swap the path to rebrand.
