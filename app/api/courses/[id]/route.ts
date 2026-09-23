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
  yardage?: number; // per-hole distance (upstream field)
  yards?: number;
  length?: number;
}

interface RawTee {
  tee_name?: string;
  name?: string;
  tee_color?: string;
  color?: string;
  total_yards?: number;
  par_total?: number;
  course_rating?: number;
  slope_rating?: number;
  rating?: number;
  slope?: number;
  holes?: RawHole[];
  _gender?: string; // set by us from the male/female group key
}

// Rating/slope for index → course handicap. Field names are from the upstream
// schema as best known; both spellings are accepted and anything non-positive is
// dropped (the app then just skips the conversion for this course).
function positive(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

function mapHoles(holes: RawHole[]) {
  return holes.map((h, i) => ({
    number: h.hole ?? h.number ?? i + 1,
    par: typeof h.par === "number" ? h.par : 4,
    // Upstream `handicap` is the stroke index. Fall back to position if absent.
    strokeIndex: typeof h.handicap === "number" && h.handicap > 0 ? h.handicap : i + 1,
  }));
}

function mapDistances(holes: RawHole[]): (number | null)[] {
  return holes.map((h) => {
    const y = h.yardage ?? h.yards ?? h.length;
    return typeof y === "number" && y > 0 ? y : null;
  });
}

// Common tee names → a representative colour. Falls back to undefined (the UI
// then uses a neutral gray). Accepts a hex `tee_color` from the API if present.
const TEE_COLORS: Record<string, string> = {
  black: "#1A1A1A",
  championship: "#1A1A1A",
  tournament: "#1A1A1A",
  blue: "#2D6CDF",
  white: "#FFFFFF",
  gold: "#C99A2E",
  yellow: "#E6C12F",
  green: "#2E8B45",
  red: "#D2342B",
  silver: "#AEB4BD",
  gray: "#9098A4",
  grey: "#9098A4",
  purple: "#7C3AED",
  orange: "#E8590C",
  combo: "#9098A4",
  forward: "#D2342B",
};

function teeColor(raw: string | undefined, name: string): string | undefined {
  if (raw && /^#?[0-9a-fA-F]{6}$/.test(raw)) return raw.startsWith("#") ? raw : `#${raw}`;
  const key = name.toLowerCase();
  for (const [word, hex] of Object.entries(TEE_COLORS)) if (key.includes(word)) return hex;
  return undefined;
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

    // The course object may be at the top level or nested under `course`.
    const course = data.course ?? data;
    const clubName: string = course.club_name ?? "";
    const courseName: string = course.course_name ?? "";
    // Join club + course, but avoid "X — X" when the API repeats the same name.
    const nameParts = [clubName, courseName].filter(Boolean);
    const displayName =
      (clubName && courseName && clubName === courseName
        ? clubName
        : nameParts.join(" — ")) || "Imported Course";

    // Tees may live under course.tees.male / .female / a flat array.
    const teeGroups: RawTee[] = [];
    const t = course.tees;
    if (Array.isArray(t)) {
      teeGroups.push(...t);
    } else if (t && typeof t === "object") {
      for (const [gender, group] of Object.entries(t)) {
        if (Array.isArray(group)) {
          teeGroups.push(...(group as RawTee[]).map((tee) => ({ ...tee, _gender: gender })));
        }
      }
    }

    const mapped = teeGroups
      .filter((tee) => Array.isArray(tee.holes) && tee.holes.length > 0)
      .map((tee) => {
        const name = tee.tee_name ?? tee.name ?? "Tee";
        return {
          name,
          gender: tee._gender ?? "",
          color: teeColor(tee.tee_color ?? tee.color, name),
          yards: tee.total_yards ?? null,
          par: tee.par_total ?? null,
          rating: positive(tee.course_rating ?? tee.rating),
          slope: positive(tee.slope_rating ?? tee.slope),
          holes: mapHoles(tee.holes as RawHole[]),
          distances: mapDistances(tee.holes as RawHole[]),
        };
      });

    // Dedupe: the API lists male + female tees separately. When a same-named tee has
    // the same rating + slope for both, they're one tee — keep the first. When the
    // rating/slope differ (they often do), keep both and tag the name (M)/(W), since
    // strokes depend on them.
    const seen = new Set<string>();
    const nameCount = new Map<string, number>();
    const tees = mapped.filter((tee) => {
      const key = `${tee.name.toLowerCase()}|${tee.rating}|${tee.slope}`;
      if (seen.has(key)) return false;
      seen.add(key);
      nameCount.set(tee.name.toLowerCase(), (nameCount.get(tee.name.toLowerCase()) ?? 0) + 1);
      return true;
    });
    for (const tee of tees) {
      if ((nameCount.get(tee.name.toLowerCase()) ?? 0) > 1 && tee.gender) {
        tee.name = `${tee.name} (${tee.gender.toLowerCase().startsWith("f") ? "W" : "M"})`;
      }
    }
    // Men's tees first, then women's (stable sort keeps the API's order within each).
    const isWomens = (g: string) => (g.toLowerCase().startsWith("f") ? 1 : 0);
    tees.sort((a, b) => isWomens(a.gender) - isWomens(b.gender));

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
