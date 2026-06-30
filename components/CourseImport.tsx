// components/CourseImport.tsx
// Search golfcourseapi.com (via our server proxy), pick a course + tee, and
// hand a populated Course back to the caller. The API key never touches here.

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
  yards: number | null;
  par: number | null;
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

  // The API matches whole words only (and is rate-limited), so we hit it with
  // just the FIRST word and re-fetch only when that word changes…
  const apiQuery = query.trim().split(/\s+/)[0] ?? "";
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function importTee(tee: TeeDetail) {
    if (!detail) return;
    const course: Course = {
      name: detail.name,
      holes: tee.holes.slice(0, 18),
      // Keep every tee's colour + per-hole yardages for the scorecard.
      tees: detail.tees.map((t) => ({
        name: t.name,
        color: t.color,
        yards: t.yards,
        distances: t.distances.slice(0, 18),
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

      {error && (
        <p className="rounded-lg bg-[#FDECEF] px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}

      {!detail && !error && !loading && results.length === 0 && query.trim().length >= 2 && (
        <p className="px-1 py-2 text-sm text-text-muted">No courses found.</p>
      )}

      {!detail && results.length > 0 && (
        <ul className="divide-y divide-divider">
          {results.map((r) => {
            const title = r.club_name || r.course_name || "Unnamed course";
            // The course/layout name (e.g. "Highlands" vs "Creek") is what tells
            // same-club courses apart — show it when it adds info.
            const layout =
              r.course_name && r.course_name !== title ? r.course_name : "";
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
                      <span className="block truncate text-xs text-text-muted">
                        {r.location}
                      </span>
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
          <p className="text-sm text-text-muted">
            {detail.tees.length > 1
              ? "Choose a tee to import:"
              : "Confirm the tee to import:"}
          </p>
          <div className="space-y-2">
            {detail.tees.map((tee, i) => (
              <button
                key={i}
                onClick={() => importTee(tee)}
                className="flex w-full items-center justify-between rounded-lg border border-card-border px-3 py-3 text-left"
              >
                <span>
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
                <span className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-on-dark">
                  Import
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
