import { NextRequest, NextResponse } from "next/server";

// Server-only proxy to golfcourseapi.com search.
// The API key is read from process.env.GOLF_COURSE_API_KEY and NEVER sent to
// the browser. The client calls only this internal route.

const API_BASE = "https://api.golfcourseapi.com/v1";

export async function GET(req: NextRequest) {
  const key = process.env.GOLF_COURSE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Course API key not configured. Add GOLF_COURSE_API_KEY to .env.local." },
      { status: 503 }
    );
  }

  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ courses: [] });
  }

  const url = `${API_BASE}/search?search_query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        // ApiKeyAuth via Authorization header. If this 401s, the prefix is wrong.
        Authorization: `Key ${key}`,
        Accept: "application/json",
      },
      // Course data changes rarely; allow brief caching.
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[courses/search] upstream ${res.status}:`, body.slice(0, 500));
      return NextResponse.json(
        { error: `Course search failed (${res.status}).` },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Normalize to a lean shape for the client.
    const courses = (data.courses ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      club_name: c.club_name ?? "",
      course_name: c.course_name ?? "",
      location: c.location ?? c.location_text ?? "",
    }));
    return NextResponse.json({ courses });
  } catch (err) {
    console.error("[courses/search] error:", err);
    return NextResponse.json({ error: "Course search request failed." }, { status: 502 });
  }
}
