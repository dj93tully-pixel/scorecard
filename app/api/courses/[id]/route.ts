import { NextRequest, NextResponse } from "next/server";

// Server-only proxy to golfcourseapi.com course detail.
// Maps the upstream tee/hole shape into our Course model defensively, since the
// exact field names (esp. `handicap` -> strokeIndex) must be verified against
// real responses. The first real response is logged once for inspection.

const API_BASE = "https://api.golfcourseapi.com/v1";

interface RawHole {
  par?: number;
  handicap?: number; // stroke index in the upstream schema
  hole?: number;
  number?: number;
}

interface RawTee {
  tee_name?: string;
  name?: string;
  total_yards?: number;
  par_total?: number;
  holes?: RawHole[];
}

function mapHoles(holes: RawHole[]) {
  return holes.map((h, i) => ({
    number: h.hole ?? h.number ?? i + 1,
    par: typeof h.par === "number" ? h.par : 4,
    // Upstream `handicap` is the stroke index. Fall back to position if absent.
    strokeIndex: typeof h.handicap === "number" && h.handicap > 0 ? h.handicap : i + 1,
  }));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = process.env.GOLF_COURSE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Course API key not configured. Add GOLF_COURSE_API_KEY to .env.local." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const url = `${API_BASE}/courses/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Key ${key}`,
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[courses/:id] upstream ${res.status}:`, body.slice(0, 500));
      return NextResponse.json(
        { error: `Course lookup failed (${res.status}).` },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Log the raw shape once for inspection (server console only).
    console.log("[courses/:id] raw response keys:", Object.keys(data));

    // The course object may be at the top level or nested under `course`.
    const course = data.course ?? data;
    const clubName: string = course.club_name ?? "";
    const courseName: string = course.course_name ?? "";
    const displayName = [clubName, courseName].filter(Boolean).join(" — ") || "Imported Course";

    // Tees may live under course.tees.male / .female / a flat array.
    const teeGroups: RawTee[] = [];
    const t = course.tees;
    if (Array.isArray(t)) {
      teeGroups.push(...t);
    } else if (t && typeof t === "object") {
      for (const group of Object.values(t)) {
        if (Array.isArray(group)) teeGroups.push(...(group as RawTee[]));
      }
    }

    const tees = teeGroups
      .filter((tee) => Array.isArray(tee.holes) && tee.holes.length > 0)
      .map((tee) => ({
        name: tee.tee_name ?? tee.name ?? "Tee",
        yards: tee.total_yards ?? null,
        par: tee.par_total ?? null,
        holes: mapHoles(tee.holes as RawHole[]),
      }));

    return NextResponse.json({
      name: displayName,
      clubName,
      courseName,
      tees,
    });
  } catch (err) {
    console.error("[courses/:id] error:", err);
    return NextResponse.json({ error: "Course lookup request failed." }, { status: 502 });
  }
}
