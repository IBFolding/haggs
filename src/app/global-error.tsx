"use client";

/** The last resort: if the page itself can't draw, say so plainly and offer a way back. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0a0a0a", color: "#f2f2f2", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>haggs hit a problem.</h1>
          <p style={{ color: "#aaa", lineHeight: 1.6 }}>Your projects are safe in this browser. Try again, or come back in a minute.</p>
          <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 999, border: 0, background: "#35e48a", color: "#0a0a0a", fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
