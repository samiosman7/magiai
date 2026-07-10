import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "MAGI — Answers you can actually defend";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social share card (Open Graph + Twitter fall back to this). Dark ops-console
// look matching the site: signal-orange mark, headline, node strip.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#06070a",
          backgroundImage:
            "radial-gradient(900px 420px at 50% -140px, rgba(255,83,32,0.16), transparent 70%)",
          color: "#e9ecf1",
          fontFamily: "sans-serif",
        }}
      >
        {/* hazard strip (solid — Satori renders repeating gradients unreliably) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: "#ff5320",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 24px",
              background: "linear-gradient(160deg, #ff5320, #d63a10)",
              color: "#150800",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: 3,
            }}
          >
            MAGI
          </div>
          <div style={{ color: "#98a1ad", fontSize: 24, letterSpacing: 4 }}>
            DECISION SYSTEM
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              maxWidth: 1020,
              fontSize: 74,
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: -1.5,
            }}
          >
            <span style={{ marginRight: 20 }}>Answers you can</span>
            <span style={{ color: "#ff5320" }}>actually defend.</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#98a1ad", maxWidth: 940 }}>
            Four adversarial AI nodes research, build, attack, and verify — then hand
            you one cited report.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["MELCHIOR · Architect", "BALTHASAR · Maverick", "CASPER · Adversary", "SYNTHESIS · Judge"].map(
            (label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "12px 18px",
                  border: "1px solid rgba(233,240,255,0.16)",
                  borderRadius: 10,
                  background: "#141821",
                  color: "#ff8a3d",
                  fontSize: 20,
                  letterSpacing: 1,
                }}
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    ),
    size
  );
}
