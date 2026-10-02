// components/CourseImport.tsx
// Search golfcourseapi.com (via our server proxy), pick a course, and hand a
// populated Course (every tee, with its rating/slope) back to the caller. The
// API key never touches here.

"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Course } from "@/lib/wolf";

interface SearchResult {
  id: number | string;
  club_name: string;
  course_name: string;
  location: string;
}

interface TeeDetail {
  name: string;
  color?: string;
  gender?: string; // "male" / "female" from the API, or ""
  yards: number | null;
  par: number | null;
  rating?: number | null;
  slope?: number | null;
  holes: { number: number; par: number; strokeIndex: number }[];
  distances: (number | null)[];
}

interface CourseDetail {
  name: string;
  clubName: string;
  courseName: string;
  tees: TeeDetail[];
}

export function CourseImport({ onImport }: { onImport: (course: Course) => void }) {
  const [query, setQuery] = useState("");
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Indexes into detail.tees of the tees ticked for import.
  const [picked, setPicked] = useState<Set<number>>(new Set());

  // Send the FULL typed query to the API. It ranks + caps its results, so a
  // distinguishing word (e.g. "West" in "Lincoln West") must reach the API —
  // querying only the first word would rank the match out and it'd never appear.
  const apiQuery = query.trim();
  useEffect(() => {
    setError(null);
    if (apiQuery.length < 2) {
      setApiResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/courses/search?q=${encodeURIComponent(apiQuery)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
            setApiResults([]);
          } else {
            setApiResults(data.courses ?? []);
          }
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setError("Search failed.");
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [apiQuery]);

  // …then filter that pool live by every word the user has typed.
  const results = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return apiResults
      .filter((r) => {
        const hay = `${r.club_name} ${r.course_name} ${r.location}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 10);
  }, [apiResults, query]);

  async function pick(id: SearchResult["id"]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      if (!data.tees || data.tees.length === 0) {
        throw new Error("This course has no hole data to import.");
      }
      setDetail(data as CourseDetail);
      // A lone tee is pre-ticked; otherwise the user chooses which to bring in.
      setPicked(new Set(data.tees.length === 1 ? [0] : []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function togglePick(i: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function importCourse() {
    if (!detail) return;
    const tees = detail.tees.filter((_, i) => picked.has(i));
    if (tees.length === 0) return;
    // Holes (par + stroke index) come from the first full-length ticked tee — men's
    // tees are listed first. Each ticked tee keeps its own rating/slope so each
    // player can pick theirs in the Players section.
    const base =
      tees.find((t) => t.holes.length >= 18) ??
      [...tees].sort((x, y) => y.holes.length - x.holes.length)[0];
    const course: Course = {
      name: detail.name,
      holes: base.holes.slice(0, 18),
      rating: null,
      slope: null,
      tees: tees.map((tee) => ({
        name: tee.name,
        color: tee.color,
        gender: tee.gender ? (tee.gender.toLowerCase().startsWith("f") ? "W" : "M") : undefined,
        yards: tee.yards,
        distances: tee.distances.slice(0, 18),
        rating: tee.rating ?? null,
        slope: tee.slope ?? null,
        par: tee.par ?? null,
      })),
    };
    onImport(course);
  }

  return (
    <div className="space-y-3">
      {!detail && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search club or course…"
            className="w-full rounded-lg border border-card-border py-2 pl-9 pr-8"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-faint">
              …
            </span>
          )}
        </div>
      )}

      {error && <p className="rounded-lg bg-[#FDECEF] px-3 py-2 text-sm text-negative">{error}</p>}

      {!detail && !error && !loading && results.length === 0 && query.trim().length >= 2 && (
        <p className="px-1 py-2 text-sm text-text-muted">No courses found.</p>
      )}

      {!detail && results.length > 0 && (
        <ul className="divide-y divide-divider">
          {results.map((r) => {
            const title = r.club_name || r.course_name || "Unnamed course";
            // The course/layout name (e.g. "Highlands" vs "Creek") is what tells
            // same-club courses apart — show it when it adds info.
            const layout = r.course_name && r.course_name !== title ? r.course_name : "";
            return (
              <li key={r.id}>
                <button
                  onClick={() => pick(r.id)}
                  className="flex w-full items-center justify-between gap-2 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{title}</span>
                    {layout && (
                      <span className="block truncate text-xs font-medium text-primary">
                        {layout}
                      </span>
                    )}
                    {r.location && (
                      <span className="block truncate text-xs text-text-muted">{r.location}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-chevron">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {detail && (
        <div className="space-y-3">
          <div>
            <div className="font-semibold">{detail.name}</div>
            <button
              onClick={() => setDetail(null)}
              className="text-xs font-semibold text-accent-on-light"
            >
              ‹ Back to results
            </button>
          </div>
          <p className="text-sm text-text-muted">Select the tees to import:</p>
          <ul className="divide-y divide-divider rounded-lg border border-card-border">
            {detail.tees.map((tee, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={picked.has(i)}
                    onChange={() => togglePick(i)}
                    className="h-5 w-5 shrink-0 accent-[#354CA1]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-full border border-card-border"
                        style={{ background: tee.color ?? "#9098A4" }}
                      />
                      {tee.name}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {tee.holes.length} holes
                      {tee.par ? ` · Par ${tee.par}` : ""}
                      {tee.yards ? ` · ${tee.yards} yds` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums">
                    {tee.rating && tee.slope ? (
                      <>
                        <span className="block font-semibold">{tee.rating}</span>
                        <span className="block text-text-muted">Slope {tee.slope}</span>
                      </>
                    ) : (
                      <span className="text-text-faint">No rating</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            onClick={importCourse}
            disabled={picked.size === 0}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-on-dark disabled:opacity-40"
          >
            {picked.size === 0
              ? "Select at least one tee"
              : `Import ${picked.size} ${picked.size === 1 ? "tee" : "tees"}`}
          </button>
        </div>
      )}
    </div>
  );
}
