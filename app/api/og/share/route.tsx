/**
 * /api/og/share — 1080×1920 PNG voor Instagram Stories / TikTok / WhatsApp Status.
 *
 * Query:
 *   ?saved=125         (€/jaar bespaard)
 *   ?provider=KPN      (welke provider)
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const saved = Number(url.searchParams.get("saved") ?? "0") || 0;
  const provider = url.searchParams.get("provider") ?? "mijn provider";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, #036b4d 0%, #064e3b 60%, #022c1f 100%)",
          padding: 80,
          fontFamily: "system-ui, sans-serif",
          color: "white",
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 700, display: "flex" }}>
          DeGeldHeld
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ fontSize: 56, opacity: 0.9, lineHeight: 1.1, display: "flex" }}>
            Ik bespaarde
          </div>
          <div style={{ fontSize: 220, fontWeight: 900, lineHeight: 1, color: "#fef3c7", display: "flex" }}>
            €{saved}
          </div>
          <div style={{ fontSize: 56, opacity: 0.9, lineHeight: 1.1, display: "flex" }}>
            bij {provider}
          </div>
          <div style={{ fontSize: 36, opacity: 0.75, lineHeight: 1.3, display: "flex" }}>
            dankzij DeGeldHeld AI 🎉
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            borderTop: "2px solid rgba(255,255,255,0.2)",
            paddingTop: 32,
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 600, display: "flex" }}>
            degeldheld.com
          </div>
          <div style={{ fontSize: 28, opacity: 0.7, display: "flex" }}>
            Eerste onderhandeling gratis
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
