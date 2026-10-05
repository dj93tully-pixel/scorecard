// components/MyCourseList.tsx
// Courses saved on this device ("My Courses"), shown in Setup's "+ My course"
// panel. Tap one to pick which of its tees to bring in (no API lookup), or to
// delete it from My Courses.

"use client";

import { useEffect, useState } from "react";
import { FlagTriangleRight, Trash2 } from "lucide-react";
import { Course } from "@/lib/wolf";
import { loadCourses, deleteMyCourse, coursePar, editableTees, withTees } from "@/lib/storage";
import { TeeSwatch } from "./TeePicker";

export function MyCourseList({ onPick }: { onPick: (course: Course) => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [selected, setSelected] = useState<Course | null>(null);
  // Indexes into the selected course's tees that are ticked for import.
  const [picked, setPicked] = useState<Set<number>>(new Set());

  useEffect(() => {
    setCourses(loadCourses());
  }, []);

  function open(c: Course) {
    setSelected(c);
    // Every saved tee starts ticked — untick the ones you don't want.
    setPicked(new Set(editableTees(c).map((_, i) => i)));
  }

  function togglePick(i: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function remove(c: Course) {
    if (!window.confirm(`Delete “${c.name}” from My Courses?`)) return;
    deleteMyCourse(c.name);
    setCourses(loadCourses());
    setSelected(null);
  }

  if (courses === null) return null;

  if (selected) {
    const tees = editableTees(selected);
    const use = () => onPick(withTees(selected, tees.filter((_, i) => picked.has(i))));
    return (
      <div className="space-y-3">
        <div>
          <div className="font-semibold">{selected.name}</div>
          <div className="text-xs text-text-muted">
            {selected.holes.length} holes · Par {coursePar(selected)}
          </div>
          <button
            onClick={() => setSelected(null)}
            className="text-xs font-semibold text-accent-on-light"
          >
            ‹ Back to My Courses
          </button>
        </div>

        {tees.length > 0 && (
          <>
            <p className="text-sm text-text-muted">Select the tees to import:</p>
            <ul className="divide-y divide-divider rounded-lg border border-card-border">
              {tees.map((t, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={picked.has(i)}
                      onChange={() => togglePick(i)}
                      className="h-5 w-5 shrink-0 accent-[#354CA1]"
                    />
                    <TeeSwatch tee={t} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{t.name}</span>
                      {t.yards ? (
                        <span className="block text-xs text-text-muted">
                          {t.yards.toLocaleString()} yds
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums">
                      {t.rating && t.slope ? (
                        <>
                          <span className="block font-semibold">{t.rating}</span>
                          <span className="block text-text-muted">Slope {t.slope}</span>
                        </>
                      ) : (
                        <span className="text-text-faint">No rating</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          onClick={use}
          disabled={tees.length > 0 && picked.size === 0}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-on-dark disabled:opacity-40"
        >
          {tees.length === 0
            ? "Use this course"
            : picked.size === 0
              ? "Select at least one tee"
              : `Import ${picked.size} ${picked.size === 1 ? "tee" : "tees"}`}
        </button>
        <button
          onClick={() => remove(selected)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-card-border py-2.5 text-sm font-semibold text-negative"
        >
          <Trash2 className="h-4 w-4" />
          Delete from My Courses
        </button>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <p className="px-1 py-2 text-sm text-text-muted">
        No saved courses yet. Set up a course in a game’s Setup → Manual, then tap{" "}
        <span className="font-semibold">+ My Courses</span>.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-divider rounded-lg border border-card-border bg-card-bg">
      {courses.map((c) => {
        const tees = editableTees(c);
        return (
          <li key={c.name}>
            <button
              onClick={() => open(c)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold">
                  <FlagTriangleRight className="h-4 w-4 shrink-0" style={{ color: "#14B8B0" }} />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="mt-0.5 block text-xs text-text-muted">
                  {c.holes.length} holes · Par {coursePar(c)}
                  {tees.length > 0 ? ` · ${tees.length} ${tees.length === 1 ? "tee" : "tees"}` : ""}
                </span>
                {tees.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {tees.map((t, i) => (
                      <TeeSwatch key={i} tee={t} size={18} />
                    ))}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-chevron">›</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
