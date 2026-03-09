"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGames } from "@/lib/hooks";

const SEASON_3_ID = "6eb519c9-faf4-4f03-94f5-b85a32bc2c62";

export default function GamesPage() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  const { authReady, leagueId } = useAuth(sb);
  const { games, error } = useGames(sb, SEASON_3_ID);

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    window.location.href = "/login";
  }

  if (!sb || !authReady) {
    return <main style={{ padding: 30, fontFamily: "sans-serif" }}>Loading…</main>;
  }

  if (!leagueId) {
    return (
      <main style={{ padding: 30, fontFamily: "sans-serif" }}>
        <h1>No league found</h1>
        <button onClick={signOut}>Sign out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 30, fontFamily: "sans-serif", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Season 3 - Games</h1>
        <button
          onClick={() => (window.location.href = "/")}
          style={{
            color: "#1d4ed8",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textDecoration: "underline",
            font: "inherit",
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p>}

      <section style={{ marginTop: 30 }}>
        <h2>All Games</h2>
        {games.length === 0 ? (
          <p style={{ color: "#555" }}>No games found.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {games.map((game) => (
              <div
                key={game.id}
                onClick={() => (window.location.href = `/games/${game.id}`)}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 16,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = "#1d4ed8";
                  el.style.boxShadow = "0 0 8px rgba(29, 78, 216, 0.2)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = "#ddd";
                  el.style.boxShadow = "none";
                }}
              >
                <h3 style={{ margin: "0 0 8px 0" }}>Game {game.game_number}</h3>
                <p style={{ margin: "0 0 8px 0", color: "#555", fontSize: "0.9rem" }}>
                  Status: <b>{game.locked ? "Locked" : "Open"}</b>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        onClick={signOut}
        style={{
          marginTop: 30,
          color: "#1d4ed8",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textDecoration: "underline",
          font: "inherit",
        }}
      >
        Sign out
      </button>
    </main>
  );
}