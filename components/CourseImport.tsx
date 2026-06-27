// components/CourseImport.tsx
// Search golfcourseapi.com (via our server proxy), pick a course + tee, and
// hand a populated Course back to the caller. The API key never touches here.

"use client";

import { useEffect, useState } from "react";
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
  yards: number | null;
  par: number | null;
  holes: { number: number; par: number; strokeIndex: number }[];
}

interface CourseDetail {
  name: string;
  clubName: string;
  courseName: string;
  tees: TeeDetail[];
}

export function CourseImport({ onImport }: { onImport: (course: Course) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live, debounced search as you type (no button needed).
  useEffect(() => {
    const q = query.trim();
    setError(null);
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/courses/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
            setResults([]);
          } else {
            const cs = data.courses ?? [];
            setResults(cs);
            if (cs.length === 0) setError("No courses found.");
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
  }, [query]);

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

      {!detail && results.length > 0 && (
        <ul className="divide-y divide-divider">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => pick(r.id)}
                className="flex w-full items-center justify-between gap-2 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.club_name}</span>
                  {r.location && (
                    <span className="block truncate text-xs text-text-muted">{r.location}</span>
                  )}
                </span>
                <span className="shrink-0 text-chevron">›</span>
              </button>
            </li>
          ))}
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
                  <span className="block font-semibold">{tee.name}</span>
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
