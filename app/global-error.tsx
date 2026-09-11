"use client";

import Image from "next/image";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Inter, "Segoe UI", sans-serif', color: "#173a33", background: "#f7faf9" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ width: "min(520px, 100%)", padding: 32, border: "1px solid #d6e4df", borderRadius: 20, background: "#fff", boxShadow: "0 18px 50px rgb(23 58 51 / 14%)", textAlign: "center" }}>
            <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#12816a", fontSize: 12, fontWeight: 750, letterSpacing: 1.2 }}><Image src="/brand-logo.png" alt="" width={24} height={24} priority/>map.filemarket</p>
            <h1 style={{ margin: "12px 0", fontSize: 36, letterSpacing: -1.5 }}>We could not open map.filemarket.</h1>
            <p style={{ color: "#6b817a", lineHeight: 1.65 }}>Your account and saved work are unchanged. Try loading the platform again.</p>
            <button onClick={reset} style={{ minHeight: 44, marginTop: 22, padding: "0 18px", border: 0, borderRadius: 10, color: "#082b24", background: "linear-gradient(110deg,#20b997,#3b82f6)", fontWeight: 700, cursor: "pointer" }}>Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
