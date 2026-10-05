// components/MyCourseList.tsx
// Courses saved on this device ("My Courses"), shown in Setup's "+ My course"
// panel: tap one to use it (no API lookup), or the trash to remove it.

"use client";

import { useEffect, useState } from "react";
import { FlagTriangleRight, Trash2 } from "lucide-react";
import { Course } from "@/lib/wolf";
import { loadCourses, deleteMyCourse, coursePar, editableTees } from "@/lib/storage";
import { TeeSwatch } from "./TeePicker";

export function MyCourseList({
  onPick,
  allowDelete = false,
}: {
  onPick?: (course: Course) => void;
  allowDelete?: boolean;
}) {
  const [courses, setCourses] = useState<Course[] | null>(null);

  useEffect(() => {
    setCourses(loadCourses());
  }, []);

  function remove(name: string) {
    if (!window.confirm(`Remove “${name}” from My Courses?`)) return;
    deleteMyCourse(name);
    setCourses(loadCourses());
  }

  if (courses === null) return null;

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
        const body = (
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
        );
        return (
          <li key={c.name} className="flex items-center gap-2 px-3 py-2.5">
            {onPick ? (
              <button
                onClick={() => onPick(c)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                {body}
                <span className="shrink-0 text-chevron">›</span>
              </button>
            ) : (
              body
            )}
            {allowDelete && (
              <button
                onClick={() => remove(c.name)}
                aria-label={`Remove ${c.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-faint active:bg-surface-2"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
