/**
 * OG-card generator — /api/og?title=...
 *
 * Renders a 1200×630 PNG via next/og (Vercel Edge), used by the
 * social meta tags. Falls back gracefully for missing params.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = url.searchParams.get("title") ?? "DeGeldHeld";
  const subtitle =
    url.searchParams.get("subtitle") ?? "Automatisch onderhandelen op je maandlasten";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)",
          padding: 64,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 32, color: "#036b4d", fontWeight: 600, display: "flex" }}>
          DeGeldHeld
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.05,
              display: "flex",
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 36, color: "#475569", lineHeight: 1.3, display: "flex" }}>
            {subtitle}
          </div>
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#0f172a",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>degeldheld.com</span>
          <span>Je betaalt alleen wat we besparen</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
