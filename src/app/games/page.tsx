"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGames, useSeasons } from "@/lib/hooks";

export default function GamesPage() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  const { authReady, leagueId } = useAuth(sb);
  const { seasons } = useSeasons(sb, leagueId);

  // Set default season on first load
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId) {
      // Default to Season 4, fall back to first season
      const season4 = seasons.find((s) => s.name === "Season 4");
      setSelectedSeasonId(season4?.id || seasons[0].id);
    }
  }, [seasons, selectedSeasonId]);

  const { games, error } = useGames(sb, selectedSeasonId);

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
        <h1>Games</h1>
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

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: "600" }}>Season:</label>
        <select
          value={selectedSeasonId || ""}
          onChange={(e) => setSelectedSeasonId(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 4,
            border: "1px solid #ddd",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p>}

      <section style={{ marginTop: 30 }}>
        <h2>Games in {seasons.find((s) => s.id === selectedSeasonId)?.name || "Season"}</h2>
        {games.length === 0 ? (
          <p style={{ color: "#555" }}>No games yet. Create your first game below.</p>
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