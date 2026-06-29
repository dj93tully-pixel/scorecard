// components/fieldhammer/FHSetup.tsx
// Field Hammer setup: players + handicaps, base stake, handicap mode, lines cap,
// and carry-ties. Creates the local game.

"use client";

import { useState } from "react";
import { Player } from "@/lib/wolf";
import { makePlayer } from "@/lib/storage";
import { FHSettings, FHHandicapMode, defaultFHSettings } from "@/lib/fieldHammerStore";

const numberInput =
  "w-16 rounded-lg border border-card-border px-2 py-2 text-center tabular-nums";

export function FHSetup({
  onCreate,
}: {
  onCreate: (players: Player[], settings: FHSettings) => void;
}) {
  const [players, setPlayers] = useState<Player[]>(() => [
    makePlayer("Player 1", 0),
    makePlayer("Player 2", 0),
    makePlayer("Player 3", 0),
    makePlayer("Player 4", 0),
  ]);
  const [s, setS] = useState<FHSettings>(defaultFHSettings());

  const setPlayer = (id: string, patch: Partial<Player>) =>
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const addPlayer = () =>
    setPlayers((ps) => (ps.length >= 6 ? ps : [...ps, makePlayer(`Player ${ps.length + 1}`, 0)]));
  const removePlayer = () => setPlayers((ps) => (ps.length <= 3 ? ps : ps.slice(0, -1)));

  const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select();

  return (
    <div className="mt-4 space-y-6">
      <div>
        <h2 className="text-xl font-bold">New Field Hammer game</h2>
        <p className="text-sm text-text-muted">
          Round-robin skins — every pair plays for the stake each hole, with hammer-the-field.
        </p>
      </div>

      {/* Players */}
      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Players</h3>
          <span className="text-xs text-text-muted">{players.length} / 3–6</span>
        </div>
        <div className="space-y-2">
          {players.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-4 text-sm font-bold text-text-faint">{i + 1}</span>
              <input
                value={p.name}
                onChange={(e) => setPlayer(p.id, { name: e.target.value })}
                placeholder="Name"
                className="min-w-0 flex-1 rounded-lg border border-card-border px-3 py-2"
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-muted">HCP</span>
                <input
                  type="number"
                  value={p.handicap}
                  onFocus={selectOnFocus}
                  onChange={(e) => setPlayer(p.id, { handicap: parseInt(e.target.value) || 0 })}
                  className={numberInput}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={addPlayer}
            disabled={players.length >= 6}
            className="flex-1 rounded-lg border border-dashed border-card-border py-2 text-sm font-semibold text-accent-on-light disabled:opacity-40"
          >
            + Add player
          </button>
          <button
            onClick={removePlayer}
            disabled={players.length <= 3}
            className="rounded-lg border border-dashed border-card-border px-4 py-2 text-sm font-semibold text-text-muted disabled:opacity-40"
          >
            − Remove
          </button>
        </div>
      </section>

      {/* Settings */}
      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h3 className="mb-1 font-bold">Stakes &amp; rules</h3>
        <div className="divide-y divide-divider">
          <Field label="Base stake — $/pairing/hole">
            <input
              type="number"
              min={0}
              value={s.baseStake}
              onFocus={selectOnFocus}
              onChange={(e) => setS({ ...s, baseStake: parseFloat(e.target.value) || 0 })}
              className={numberInput}
            />
          </Field>
          <Field label="Handicap mode">
            <select
              value={s.handicapMode}
              onChange={(e) => setS({ ...s, handicapMode: e.target.value as FHHandicapMode })}
              className="rounded-lg border border-card-border px-2 py-2"
            >
              <option value="offLow">Off low</option>
              <option value="full">Full</option>
              <option value="gross">Gross (no strokes)</option>
            </select>
          </Field>
          <Field label="Hammer lines cap (max doublings)">
            <input
              type="number"
              min={0}
              value={s.linesCap}
              onFocus={selectOnFocus}
              onChange={(e) => setS({ ...s, linesCap: Math.max(0, parseInt(e.target.value) || 0) })}
              className={numberInput}
            />
          </Field>
          <Field label="Carry ties to next hole">
            <input
              type="checkbox"
              checked={s.carryTies}
              onChange={(e) => setS({ ...s, carryTies: e.target.checked })}
              className="h-6 w-6 accent-[#354CA1]"
            />
          </Field>
        </div>
      </section>

      <button
        onClick={() => onCreate(players, s)}
        className="w-full rounded-xl bg-primary py-3 text-base font-bold text-on-dark"
      >
        Start game
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      {children}
    </label>
  );
}
