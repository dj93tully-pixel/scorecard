// components/SetupTab.tsx
// Last tab. Order: Course (top) → Players (names + handicap/pops, reorder =
// tee order) → Money & rules. Everything persists immediately via updateRound.

"use client";

import { useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Round, Course, HandicapMode, sanitizeEntries } from "@/lib/wolf";
import {
  makePlayer,
  blankCourse,
  coursePar,
  strokeIndexIssues,
} from "@/lib/storage";
import { CourseImport } from "./CourseImport";
import { gameTypeMeta, TEAM_COLORS } from "@/lib/gametypes";
import { JUNK_TYPES, junkConfig } from "@/lib/junk";

function Field({
  label,
  hint,
  disabled,
  children,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block py-2 ${disabled ? "opacity-40" : ""}`}>
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {children}
      </span>
      {hint && (
        <span className="mt-1 block max-w-[42ch] text-xs leading-snug text-text-muted">{hint}</span>
      )}
    </label>
  );
}

export function SetupTab({
  round,
  updateRound,
}: {
  round: Round;
  updateRound: (patch: Partial<Round> | ((r: Round) => Round)) => void;
}) {
  const [coursePanel, setCoursePanel] = useState<"none" | "import" | "manual">("none");
  const [flash, setFlash] = useState<string | null>(null);

  const { players, settings, teeOrder, course } = round;
  const siIssues = strokeIndexIssues(course);
  const isDirect = settings.handicapMode === "direct";
  // "New Course" is the blank default — treat anything else as a real course.
  const hasCourse = course.name.trim() !== "" && course.name !== "New Course";

  const meta = gameTypeMeta(round);
  const gameType = round.gameType ?? "wolf";
  const isWolf = gameType === "wolf";
  // Carry/hammer-carry rules only apply to the per-hole carry games. Total/points
  // and segment games (stroke, points-Stableford, 11s, Nassau) hide them.
  const showCarry = ![
    "vegas",
    "stroke",
    "elevens",
    "nassau",
    "stableford",
    "modifiedstableford",
  ].includes(gameType);
  const nassauFormat = settings.nassauFormat ?? "teams";
  // Nassau in team format uses the same A/B assignment UI as Best Ball / Vegas.
  const showTeams = meta.hasTeams || (gameType === "nassau" && nassauFormat === "teams");
  const playerCountOk =
    players.length >= meta.players.min && players.length <= meta.players.max;

  // Select the contents of a number field on focus so typing replaces the
  // existing digit instead of appending to it (e.g. 1 → 3, not 13).
  const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) =>
    e.currentTarget.select();

  // ── Course ──
  function setHole(num: number, patch: Partial<{ par: number; strokeIndex: number }>) {
    updateRound((r) => ({
      ...r,
      course: {
        ...r.course,
        holes: r.course.holes.map((h) => (h.number === num ? { ...h, ...patch } : h)),
      },
    }));
  }
  function importCourse(c: Course) {
    updateRound((r) => ({ ...r, course: c }));
    setCoursePanel("none"); // collapse the dropdowns
    const par = c.holes.reduce((s, h) => s + h.par, 0);
    setFlash(`Imported “${c.name}” — ${c.holes.length} holes, par ${par}`);
  }
  function resetCourse() {
    updateRound((r) => ({ ...r, course: blankCourse() }));
  }
  function setCourseName(name: string) {
    updateRound((r) => ({ ...r, course: { ...r.course, name } }));
  }

  // ── Players ──
  function setPlayer(
    id: string,
    patch: Partial<{ name: string; handicap: number; pops: number }>
  ) {
    updateRound((r) => ({
      ...r,
      players: r.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }
  function addPlayer() {
    if (players.length >= meta.players.max) return;
    updateRound((r) => {
      const p = makePlayer(`Player ${r.players.length + 1}`, 0);
      return { ...r, players: [...r.players, p], teeOrder: [...r.teeOrder, p.id] };
    });
  }
  function removePlayer(id: string) {
    if (players.length <= meta.players.min) return;
    updateRound((r) => {
      const nextPlayers = r.players.filter((p) => p.id !== id);
      const nextTeeOrder = r.teeOrder.filter((t) => t !== id);
      // Drop the player from fixed-team assignments so no ghost id lingers, and scrub
      // existing entries (their scores + any hole where they were the wolf/partner) so
      // removing them can't silently void holes or orphan scores.
      const teams = { ...(r.settings.teams ?? {}) };
      delete teams[id];
      return {
        ...r,
        players: nextPlayers,
        teeOrder: nextTeeOrder,
        settings: { ...r.settings, teams },
        entries: sanitizeEntries(r.entries, nextPlayers, nextTeeOrder),
      };
    });
  }
  function moveTee(id: string, dir: -1 | 1) {
    updateRound((r) => {
      const order = [...r.teeOrder];
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return r;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...r, teeOrder: order };
    });
  }

  function setTeam(id: string, team: "A" | "B" | "C" | "D") {
    updateRound((r) => ({
      ...r,
      settings: { ...r.settings, teams: { ...(r.settings.teams ?? {}), [id]: team } },
    }));
  }

  // ── Settings ──
  function setSetting<K extends keyof Round["settings"]>(
    key: K,
    value: Round["settings"][K]
  ) {
    updateRound((r) => ({ ...r, settings: { ...r.settings, [key]: value } }));
  }
  function setPopsMode(direct: boolean) {
    setSetting("handicapMode", direct ? "direct" : "offLow");
  }
  // Carryover ties gates the three carry sub-toggles. Turning it off forces them
  // off too, so they can never look "still on" while their prerequisite is off.
  function setCarryover(on: boolean) {
    updateRound((r) => ({
      ...r,
      settings: on
        ? { ...r.settings, carryover: true }
        : {
            ...r.settings,
            carryover: false,
            hammerCarry: false,
            pressCarryover: false,
            pressHammerCarry: false,
          },
    }));
  }

  // ── Side bets (junk) ──
  function setJunkOn(id: string, on: boolean) {
    updateRound((r) => {
      const list = (r.settings.junk ?? []).filter((j) => j.id !== id);
      if (on) {
        const t = JUNK_TYPES.find((x) => x.id === id);
        list.push({ id, value: t?.defaultValue ?? 1 });
      }
      return { ...r, settings: { ...r.settings, junk: list } };
    });
  }
  function setJunkValue(id: string, value: number) {
    updateRound((r) => ({
      ...r,
      settings: {
        ...r.settings,
        junk: (r.settings.junk ?? []).map((j) => (j.id === id ? { ...j, value } : j)),
      },
    }));
  }

  const numberInput =
    "w-16 rounded-lg border border-card-border px-2 py-2 text-center tabular-nums";

  // Render players in tee order so the list order IS the rotation order.
  const orderedPlayers = teeOrder
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Round Setup</h2>
        <span className="rounded-full bg-pill-bg px-2.5 py-0.5 text-xs font-bold text-pill-text">
          {meta.label}
        </span>
      </div>

      {/* Course */}
      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h3 className="mb-2 font-bold">Course</h3>

        {flash && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-pill-bg px-3 py-2 text-sm font-semibold text-pill-text">
            <span>✓ {flash}</span>
            <button
              onClick={() => setFlash(null)}
              className="shrink-0 text-pill-text/70"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Current course summary */}
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-text-muted">
          <span className="truncate">
            {hasCourse ? `${course.name} · Par ${coursePar(course)}` : "No course set"}
          </span>
          {hasCourse &&
            (siIssues.length > 0 ? (
              <span className="shrink-0 text-negative">
                SI: {siIssues.slice(0, 2).join(", ")}
                {siIssues.length > 2 ? "…" : ""}
              </span>
            ) : (
              <span className="shrink-0 text-positive">SI 1–18 ✓</span>
            ))}
        </div>

        {/* Two options — each drops down its panel */}
        <div className="flex gap-2">
          <button
            onClick={() => setCoursePanel((p) => (p === "import" ? "none" : "import"))}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold ${
              coursePanel === "import"
                ? "bg-primary text-on-dark"
                : "border border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Search className="h-4 w-4" />
            Import course
          </button>
          <button
            onClick={() => setCoursePanel((p) => (p === "manual" ? "none" : "manual"))}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold ${
              coursePanel === "manual"
                ? "bg-primary text-on-dark"
                : "border border-card-border bg-card-bg text-text-muted"
            }`}
          >
            <Pencil className="h-4 w-4" />
            Manual
          </button>
        </div>

        {coursePanel === "import" && (
          <div className="mt-3">
            <CourseImport onImport={importCourse} />
          </div>
        )}

        {coursePanel === "manual" && (
          <div className="mt-3 overflow-x-auto">
            <input
              type="text"
              value={course.name === "New Course" ? "" : course.name}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Course name"
              className="mb-3 w-full rounded border border-card-border px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
            <table className="w-full text-center text-sm">
              <thead>
                <tr className="text-xs text-text-muted">
                  <th className="px-1 py-1 text-left">Hole</th>
                  <th className="px-1 py-1">Par</th>
                  <th className="px-1 py-1">Hcp</th>
                </tr>
              </thead>
              <tbody>
                {course.holes.map((h) => (
                  <tr key={h.number} className="border-t border-divider">
                    <td className="px-1 py-1 text-left font-semibold">{h.number}</td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={h.par}
                        onFocus={selectOnFocus}
                        onChange={(e) =>
                          setHole(h.number, { par: parseInt(e.target.value) || 0 })
                        }
                        className="w-14 rounded border border-card-border px-1 py-1 text-center"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        min={1}
                        max={18}
                        value={h.strokeIndex}
                        onFocus={selectOnFocus}
                        onChange={(e) =>
                          setHole(h.number, { strokeIndex: parseInt(e.target.value) || 0 })
                        }
                        className="w-14 rounded border border-card-border px-1 py-1 text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                onClick={resetCourse}
                className="text-xs font-semibold text-negative"
              >
                Reset course
              </button>
              <button
                onClick={() => setCoursePanel("none")}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-dark"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Players */}
      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Players</h3>
          <span
            className={`text-xs font-semibold ${
              playerCountOk ? "text-text-muted" : "text-negative"
            }`}
          >
            {players.length} /{" "}
            {meta.players.min === meta.players.max
              ? meta.players.max
              : `${meta.players.min}–${meta.players.max}`}
          </span>
        </div>
        {!playerCountOk && (
          <p className="mb-2 rounded-lg bg-tint-caution px-3 py-2 text-xs font-semibold text-text-primary">
            {meta.label} needs{" "}
            {meta.players.min === meta.players.max
              ? `exactly ${meta.players.max}`
              : `${meta.players.min}–${meta.players.max}`}{" "}
            players.
          </p>
        )}

        {/* Handicap / Pops toggle */}
        <div className="mb-3 flex rounded-lg bg-page-bg p-1 text-sm font-semibold">
          <button
            onClick={() => setPopsMode(false)}
            className={`flex-1 rounded-md py-2 ${
              !isDirect ? "bg-primary text-on-dark" : "text-text-muted"
            }`}
          >
            Handicap
          </button>
          <button
            onClick={() => setPopsMode(true)}
            className={`flex-1 rounded-md py-2 ${
              isDirect ? "bg-primary text-on-dark" : "text-text-muted"
            }`}
          >
            Pops
          </button>
        </div>
        {!isDirect && (
          <div className="mb-3">
            <Field label="Handicap mode">
              <select
                value={settings.handicapMode}
                onChange={(e) => setSetting("handicapMode", e.target.value as HandicapMode)}
                className="rounded-lg border border-card-border px-2 py-2"
              >
                <option value="offLow">Off Low (Relative)</option>
                <option value="full">Full (Absolute)</option>
              </select>
            </Field>
          </div>
        )}

        <div className="space-y-2">
          {orderedPlayers.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-4 text-sm font-bold text-text-faint">{i + 1}</span>
              <input
                value={p.name}
                onChange={(e) => setPlayer(p.id, { name: e.target.value })}
                placeholder="Name"
                className="min-w-0 flex-1 rounded-lg border border-card-border px-3 py-2"
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-muted">{isDirect ? "Pops" : "HCP"}</span>
                {isDirect ? (
                  <input
                    type="number"
                    min={0}
                    value={p.pops ?? 0}
                    onFocus={selectOnFocus}
                    onChange={(e) => setPlayer(p.id, { pops: parseInt(e.target.value) || 0 })}
                    className={numberInput}
                  />
                ) : (
                  <input
                    type="number"
                    value={p.handicap}
                    onFocus={selectOnFocus}
                    onChange={(e) =>
                      setPlayer(p.id, { handicap: parseInt(e.target.value) || 0 })
                    }
                    className={numberInput}
                  />
                )}
              </div>
              <div className="flex flex-col">
                <button
                  onClick={() => moveTee(p.id, -1)}
                  disabled={i === 0}
                  className="px-1 text-sm leading-none disabled:opacity-30"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveTee(p.id, 1)}
                  disabled={i === orderedPlayers.length - 1}
                  className="px-1 text-sm leading-none disabled:opacity-30"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={addPlayer}
            disabled={players.length >= meta.players.max}
            className="flex-1 rounded-lg border border-dashed border-card-border py-2 text-sm font-semibold text-accent-on-light disabled:opacity-40"
          >
            + Add player
          </button>
          <button
            onClick={() => {
              const last = orderedPlayers[orderedPlayers.length - 1];
              if (last) removePlayer(last.id);
            }}
            disabled={players.length <= meta.players.min}
            className="rounded-lg border border-dashed border-card-border px-4 py-2 text-sm font-semibold text-text-muted disabled:opacity-40"
          >
            − Remove
          </button>
        </div>
        <p className="mt-2 text-xs text-text-faint">
          {isDirect
            ? "Enter how many strokes (pops) each player gets directly. "
            : "Enter handicaps; pops are calculated automatically. "}
          {isWolf
            ? "List order is the tee order — the wolf rotates down this list each hole (override on any hole in Scores)."
            : meta.rotatesTeams
              ? "List order sets the rotating partnerships (1&2 v 3&4, then 1&3 v 2&4, then 1&4 v 2&3)."
              : "List order is the playing order."}
        </p>
      </section>

      {/* Teams (Best Ball / Vegas / team Nassau) */}
      {showTeams && (
        <section className="rounded-xl border border-card-border bg-card-bg p-4">
          <h3 className="mb-1 font-bold">Teams</h3>
          <p className="mb-3 text-xs text-text-muted">
            {gameType === "bestball"
              ? "Assign each player to a team (A–D). Two teams or up to four — any split."
              : "Assign each player to team A or B (any split — 1v3, 2v2, 2v3…)."}
          </p>
          <div className="space-y-2">
            {orderedPlayers.map((p) => {
              const team = settings.teams?.[p.id] ?? "A";
              const teamOptions = gameType === "bestball" ? (["A", "B", "C", "D"] as const) : (["A", "B"] as const);
              return (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {p.name || "Unnamed"}
                  </span>
                  <div className="flex overflow-hidden rounded-lg border border-card-border">
                    {teamOptions.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTeam(p.id, t)}
                        className="px-3.5 py-1.5 text-sm font-bold"
                        style={
                          team === t
                            ? { background: TEAM_COLORS[t], color: "#fff" }
                            : { color: "#8A90A0" }
                        }
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Money & rules */}
      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h3 className="mb-1 font-bold">Money &amp; rules</h3>
        <div className="divide-y divide-divider">
          {gameType === "nassau" && (
            <Field label="Format">
              <select
                value={nassauFormat}
                onChange={(e) =>
                  setSetting("nassauFormat", e.target.value as "teams" | "robin")
                }
                className="rounded-lg border border-card-border px-2 py-2"
              >
                <option value="teams">Teams (A vs B)</option>
                <option value="robin">Everyone vs everyone</option>
              </select>
            </Field>
          )}
          {(isWolf ||
            gameType === "bestball" ||
            gameType === "sixes" ||
            gameType === "stroke" ||
            gameType === "stableford" ||
            gameType === "modifiedstableford" ||
            gameType === "elevens" ||
            gameType === "nassau") && (
            <Field
              label={
                gameType === "stroke" || gameType === "elevens"
                  ? "$ per stroke"
                  : gameType === "stableford" || gameType === "modifiedstableford"
                    ? "$ per point"
                    : gameType === "nassau"
                      ? "$ per bet (F/B/18)"
                      : "Stake — $/hole"
              }
            >
              <input
                type="number"
                min={0}
                value={settings.stake}
                onFocus={selectOnFocus}
                onChange={(e) => setSetting("stake", parseFloat(e.target.value) || 0)}
                className={numberInput}
              />
            </Field>
          )}
          {gameType === "skins" && (
            <Field label="Skin value — $">
              <input
                type="number"
                min={0}
                value={settings.skinValue ?? 1}
                onFocus={selectOnFocus}
                onChange={(e) => setSetting("skinValue", parseFloat(e.target.value) || 0)}
                className={numberInput}
              />
            </Field>
          )}
          {gameType === "vegas" && (
            <>
              <Field label="Point value — $">
                <input
                  type="number"
                  min={0}
                  value={settings.pointValue ?? 1}
                  onFocus={selectOnFocus}
                  onChange={(e) => setSetting("pointValue", parseFloat(e.target.value) || 0)}
                  className={numberInput}
                />
              </Field>
              <Field label="Birdie flips opponent">
                <input
                  type="checkbox"
                  checked={settings.birdieFlip ?? true}
                  onChange={(e) => setSetting("birdieFlip", e.target.checked)}
                  className="h-6 w-6 accent-[#354CA1]"
                />
              </Field>
            </>
          )}
          {(isWolf || gameType === "bestball") && (
            <Field label={isWolf ? "Wolf team $/hole (0 = same)" : "Team A $/hole (0 = same)"}>
              <input
                type="number"
                min={0}
                value={settings.wolfStake ?? 0}
                onFocus={selectOnFocus}
                onChange={(e) => setSetting("wolfStake", parseFloat(e.target.value) || 0)}
                className={numberInput}
              />
            </Field>
          )}
          {isWolf && (
            <>
              <Field label="Lone wolf multiplier">
                <input
                  type="number"
                  min={1}
                  value={settings.loneMult}
                  onFocus={selectOnFocus}
                  onChange={(e) => setSetting("loneMult", parseFloat(e.target.value) || 1)}
                  className={numberInput}
                />
              </Field>
              <Field label="Blind wolf multiplier">
                <input
                  type="number"
                  min={1}
                  value={settings.blindMult}
                  onFocus={selectOnFocus}
                  onChange={(e) => setSetting("blindMult", parseFloat(e.target.value) || 1)}
                  className={numberInput}
                />
              </Field>
            </>
          )}
          {showCarry && (
            <Field
              label="Carryover ties"
              hint="When a hole is tied (pushed), its money isn't voided — it rolls forward and is added onto the next hole someone wins."
            >
              <input
                type="checkbox"
                checked={settings.carryover}
                onChange={(e) => setCarryover(e.target.checked)}
                className="h-6 w-6 accent-[#354CA1]"
              />
            </Field>
          )}
          {showCarry && (
            <Field
              label="Carryover hammers"
              hint="If the tied hole was hammered, roll forward the full doubled amount instead of just the base stake. (Needs Carryover ties on.)"
              disabled={!settings.carryover}
            >
              <input
                type="checkbox"
                disabled={!settings.carryover}
                checked={settings.hammerCarry ?? false}
                onChange={(e) => setSetting("hammerCarry", e.target.checked)}
                className="h-6 w-6 accent-[#354CA1] disabled:cursor-not-allowed"
              />
            </Field>
          )}
          {showCarry && (
            <Field
              label="Carryover hammers inside press bets"
              hint="Inside a press, a hammered tie carries at its doubled size instead of the base stake — like Carryover hammered value, but for the press. (Needs Carryover ties on.)"
              disabled={!settings.carryover}
            >
              <input
                type="checkbox"
                disabled={!settings.carryover}
                checked={settings.pressHammerCarry ?? false}
                onChange={(e) => setSetting("pressHammerCarry", e.target.checked)}
                className="h-6 w-6 accent-[#354CA1] disabled:cursor-not-allowed"
              />
            </Field>
          )}
          {showCarry && (
            <Field
              label="Carryover ties into new press bets"
              hint="When you open a press right after a tie, the money carrying from that tie is copied into the new press so it starts bigger (it still stays in the main bet too). (Needs Carryover ties on.)"
              disabled={!settings.carryover}
            >
              <input
                type="checkbox"
                disabled={!settings.carryover}
                checked={settings.pressCarryover ?? false}
                onChange={(e) => setSetting("pressCarryover", e.target.checked)}
                className="h-6 w-6 accent-[#354CA1] disabled:cursor-not-allowed"
              />
            </Field>
          )}
        </div>
      </section>

      {/* Side bets (junk) — ride on top of any game type, fold into settle-up */}
      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h3 className="mb-1 font-bold">Side bets</h3>
        <p className="mb-3 text-xs text-text-muted">
          Optional junk that rides on top of the main game and folds into the final
          settle-up. Birdies and eagles score automatically; the rest are tapped per
          hole on the Score tab.
        </p>
        <div className="divide-y divide-divider">
          {JUNK_TYPES.map((t) => {
            const cfg = junkConfig(settings, t.id);
            const on = !!cfg;
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2">
                <label className="flex min-w-0 flex-1 items-start gap-2">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setJunkOn(t.id, e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#354CA1]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text-primary">
                      {t.label}
                    </span>
                    <span className="block text-xs text-text-faint">{t.blurb}</span>
                  </span>
                </label>
                {on && (
                  <span className="flex shrink-0 items-center gap-1 text-sm text-text-muted">
                    $
                    <input
                      type="number"
                      min={0}
                      value={cfg!.value}
                      onFocus={selectOnFocus}
                      onChange={(e) => setJunkValue(t.id, parseFloat(e.target.value) || 0)}
                      className={numberInput}
                    />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
