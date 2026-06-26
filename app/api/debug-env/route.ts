import { NextResponse } from "next/server";

// TEMPORARY diagnostic — reports whether the course API key is visible to the
// running function WITHOUT ever exposing its value. Safe to call publicly:
// it returns only booleans, a length, and the *names* of env vars that look
// related (to catch typos like a trailing space or wrong word). Delete after use.

export const dynamic = "force-dynamic";

export function GET() {
  const key = process.env.GOLF_COURSE_API_KEY;
  const relatedNames = Object.keys(process.env)
    .filter((k) => /GOLF|COURSE/i.test(k))
    .sort();

  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV ?? "(none)",
    keyPresent: typeof key === "string" && key.length > 0,
    keyLength: key ? key.length : 0,
    // Only NAMES, never values — surfaces typos/whitespace in the var name.
    relatedEnvVarNames: relatedNames,
  });
}
