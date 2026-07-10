"use client";

// Only fires when the root layout itself throws — it replaces <html>/<body>,
// so styles are inlined rather than relying on globals.css.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#06070a",
          color: "#e9ecf1",
          fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            padding: "8px 16px",
            background: "linear-gradient(160deg, #ff5320, #d63a10)",
            color: "#150800",
            fontWeight: 800,
            letterSpacing: 4,
          }}
        >
          MAGI
        </div>
        <h1 style={{ fontSize: 24, margin: 0 }}>MAGI is temporarily offline.</h1>
        <p style={{ color: "#98a1ad", margin: 0, maxWidth: 420 }}>
          A core error interrupted the app. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            padding: "12px 22px",
            border: 0,
            background: "#ff5320",
            color: "#150800",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
