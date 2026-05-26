"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, usePlayers, useSeasons, useSeasonLeaderboard } from "@/lib/hooks";
import { SCORING } from "@/lib/queries";

export default function LeaderboardPage() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  const { authReady, leagueId } = useAuth(sb);
  const { seasons } = useSeasons(sb, leagueId);
  const { players } = usePlayers(sb, leagueId);

  // Set default season on first load
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId) {
      // Default to Season 4, fall back to first season
      const season4 = seasons.find((s) => s.name === "Season 4");
      setSelectedSeasonId(season4?.id || seasons[0].id);
    }
  }, [seasons, selectedSeasonId]);

  const { leaderboard } = useSeasonLeaderboard(sb, selectedSeasonId, players);

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
    <main style={{ padding: 30, fontFamily: "sans-serif", maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Leaderboard</h1>
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

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
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

      <p style={{ color: "#333", marginTop: 12, fontSize: "0.95rem" }}>
        Scoring: Win <b>{SCORING.win}</b> pts, Draw <b>{SCORING.draw}</b> pts, Loss <b>{SCORING.loss}</b> pt, No-show <b>{SCORING.noShow}</b> pts. Byes count as wins.
        <br />
        Tiebreakers: Points → Wins → OWP (Opponent Win %)
      </p>

      {players.length === 0 ? (
        <p>No players yet.</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 20 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ backgroundColor: "#1f2937", color: "white" }}>
                {["Rank", "Player", "Points", "W", "D", "L", "Byes", "No-shows", "Played", "OWP"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "14px 10px",
                      fontWeight: "700",
                      fontSize: "0.95rem",
                      borderRight: "1px solid #374151",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, i) => (
                <tr
                  key={row.playerId}
                  style={{
                    backgroundColor: i % 2 === 0 ? "#ffffff" : "#f3f4f6",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <td
                    style={{
                      padding: "12px 10px",
                      fontWeight: "700",
                      fontSize: "1.1rem",
                      color: "#1f2937",
                      borderRight: "1px solid #e5e7eb",
                    }}
                  >
                    {i + 1}
                  </td>
                  <td
                    style={{
                      padding: "12px 10px",
                      fontWeight: "600",
                      color: "#1f2937",
                      borderRight: "1px solid #e5e7eb",
                    }}
                  >
                    {row.name}
                  </td>
                  <td
                    style={{
                      padding: "12px 10px",
                      fontWeight: "700",
                      fontSize: "1.1rem",
                      color: "#059669",
                      borderRight: "1px solid #e5e7eb",
                    }}
                  >
                    {row.points}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#1f2937", borderRight: "1px solid #e5e7eb" }}>
                    {row.wins}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#1f2937", borderRight: "1px solid #e5e7eb" }}>
                    {row.draws}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#1f2937", borderRight: "1px solid #e5e7eb" }}>
                    {row.losses}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#1f2937", borderRight: "1px solid #e5e7eb" }}>
                    {row.byes}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#1f2937", borderRight: "1px solid #e5e7eb" }}>
                    {row.noShows}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#1f2937", borderRight: "1px solid #e5e7eb" }}>
                    {row.played}
                  </td>
                  <td
                    style={{
                      padding: "12px 10px",
                      fontWeight: "600",
                      color: "#0891b2",
                    }}
                  >
                    {(row.owp * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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