// components/SetupTab.tsx
// Last tab. Order: Course (top) → Players (names + handicap/pops, reorder =
// tee order) → Money & rules. Everything persists immediately via updateRound.

"use client";

import { useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Round, Course, HandicapMode } from "@/lib/wolf";
import {
  makePlayer,
  blankCourse,
  coursePar,
  strokeIndexIssues,
} from "@/lib/storage";
import { CourseImport } from "./CourseImport";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      {children}
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
    if (players.length >= 5) return;
    updateRound((r) => {
      const p = makePlayer(`Player ${r.players.length + 1}`, 0);
      return { ...r, players: [...r.players, p], teeOrder: [...r.teeOrder, p.id] };
    });
  }
  function removePlayer(id: string) {
    if (players.length <= 3) return;
    updateRound((r) => ({
      ...r,
      players: r.players.filter((p) => p.id !== id),
      teeOrder: r.teeOrder.filter((t) => t !== id),
    }));
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

  const numberInput =
    "w-16 rounded-lg border border-card-border px-2 py-2 text-center tabular-nums";

  // Render players in tee order so the list order IS the rotation order.
  const orderedPlayers = teeOrder
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Round Setup</h2>

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
            <button
              onClick={resetCourse}
              className="mt-2 text-xs font-semibold text-negative"
            >
              Reset course
            </button>
          </div>
        )}
      </section>

      {/* Players */}
      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Players</h3>
          <span className="text-xs text-text-muted">{players.length} / 5</span>
        </div>

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
        <p className="mb-2 text-xs text-text-muted">
          {isDirect
            ? "Enter how many strokes (pops) each player gets directly."
            : "Enter handicaps; pops are calculated automatically."}
        </p>

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
            disabled={players.length >= 5}
            className="flex-1 rounded-lg border border-dashed border-card-border py-2 text-sm font-semibold text-accent-on-light disabled:opacity-40"
          >
            + Add player
          </button>
          <button
            onClick={() => {
              const last = orderedPlayers[orderedPlayers.length - 1];
              if (last) removePlayer(last.id);
            }}
            disabled={players.length <= 3}
            className="rounded-lg border border-dashed border-card-border px-4 py-2 text-sm font-semibold text-text-muted disabled:opacity-40"
          >
            − Remove
          </button>
        </div>
        <p className="mt-2 text-xs text-text-faint">
          List order is the tee order — the wolf rotates down this list each hole
          (override on any hole in Scores).
        </p>
      </section>

      {/* Money & rules */}
      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h3 className="mb-1 font-bold">Money &amp; rules</h3>
        <div className="divide-y divide-divider">
          <Field label="Stake — field $/hole">
            <input
              type="number"
              min={0}
              value={settings.stake}
              onFocus={selectOnFocus}
              onChange={(e) => setSetting("stake", parseFloat(e.target.value) || 0)}
              className={numberInput}
            />
          </Field>
          <Field label="Wolf team $/hole (0 = same)">
            <input
              type="number"
              min={0}
              value={settings.wolfStake ?? 0}
              onFocus={selectOnFocus}
              onChange={(e) => setSetting("wolfStake", parseFloat(e.target.value) || 0)}
              className={numberInput}
            />
          </Field>
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
          <Field label="Carryover ties">
            <input
              type="checkbox"
              checked={settings.carryover}
              onChange={(e) => setSetting("carryover", e.target.checked)}
              className="h-6 w-6 accent-[#354CA1]"
            />
          </Field>
          {!isDirect && (
            <Field label="Handicap mode">
              <select
                value={settings.handicapMode}
                onChange={(e) => setSetting("handicapMode", e.target.value as HandicapMode)}
                className="rounded-lg border border-card-border px-2 py-2"
              >
                <option value="offLow">Off low</option>
                <option value="full">Full</option>
              </select>
            </Field>
          )}
        </div>
      </section>

      <p className="px-1 text-center text-xs text-text-faint">
        Everything saves automatically to this device.
      </p>
    </div>
  );
}
