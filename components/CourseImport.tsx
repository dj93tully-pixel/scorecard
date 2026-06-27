// components/CourseImport.tsx
// Search golfcourseapi.com (via our server proxy), pick a course + tee, and
// hand a populated Course back to the caller. The API key never touches here.

"use client";

import { useState } from "react";
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

export function CourseImport({
  onImport,
  onClose,
}: {
  onImport: (course: Course) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const res = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.courses ?? []);
      if ((data.courses ?? []).length === 0) setError("No courses found.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

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
    <div className="space-y-3 rounded-xl border border-card-border bg-card-bg p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Import course</h3>
        <button
          onClick={onClose}
          className="text-sm font-semibold text-text-muted"
        >
          Close
        </button>
      </div>

      {!detail && (
        <form onSubmit={search} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search club or course…"
            className="flex-1 rounded-lg border border-card-border px-3 py-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-dark disabled:opacity-50"
          >
            {loading ? "…" : "Search"}
          </button>
        </form>
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
