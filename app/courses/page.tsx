"use client";

import { useEffect } from "react";
import { useHeader } from "@/lib/header-context";
import { MyCourseList } from "@/components/MyCourseList";

export default function MyCoursesPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader({ title: "My Courses", backHref: "/" });
    return () => setHeader({});
  }, [setHeader]);

  return (
    <div className="mt-4 animate-fade-in space-y-3">
      <p className="text-sm text-text-muted">
        Courses saved on this device. Load one in a game’s Setup with{" "}
        <span className="font-semibold">+ My course</span> — no search needed.
      </p>
      <MyCourseList allowDelete />
    </div>
  );
}
