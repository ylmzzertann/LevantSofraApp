"use client";

/**
 * The last line of defence: the root layout itself failed — most likely the
 * database is unreachable, since the layout loads the menu. It replaces the
 * whole document, so it can't rely on the app's fonts or stylesheet and styles
 * itself inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFF6E5",
          color: "#3B3B3B",
          fontFamily: "Georgia, 'Times New Roman', serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 380 }}>
          <h1 style={{ fontStyle: "italic", fontWeight: 500, fontSize: 28, margin: "0 0 10px" }}>
            We&rsquo;re having trouble opening the menu
          </h1>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 1.6, opacity: 0.7 }}>
            It&rsquo;s on our side, not your phone. Give it a moment and try again, or ask one of us
            to take your order.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 12,
              minHeight: 44,
              padding: "0 22px",
              borderRadius: 999,
              border: "none",
              background: "#3B3B3B",
              color: "#FFF6E5",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, opacity: 0.45, marginTop: 18 }}>
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
