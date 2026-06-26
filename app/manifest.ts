import type { MetadataRoute } from "next";

// Minimal PWA manifest so Wolf can be added to a phone's home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wolf — Golf Money Game",
    short_name: "Wolf",
    description: "Track scores, pops, and the Wolf money game live on the course.",
    start_url: "/",
    display: "standalone",
    background_color: "#0C0C0E",
    theme_color: "#0C0C0E",
    icons: [
      // Inline SVG wolf mark so install works without separate asset files.
      {
        src:
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0C0C0E"/><path d="M12 8 L20 22 L14 34 C12 44 20 56 32 56 C44 56 52 44 50 34 L44 22 L52 8 L40 16 L24 16 L12 8 Z" fill="#6BA0FF"/></svg>`
          ),
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
