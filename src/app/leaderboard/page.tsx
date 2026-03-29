"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, usePlayers, useSeasonLeaderboard } from "@/lib/hooks";
import { SCORING } from "@/lib/queries";

const SEASON_3_ID = "6eb519c9-faf4-4f03-94f5-b85a32bc2c62";

export default function LeaderboardPage() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  const { authReady, leagueId } = useAuth(sb);
  const { players } = usePlayers(sb, leagueId);
  const { leaderboard } = useSeasonLeaderboard(sb, SEASON_3_ID, players);

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
        <h1>Leaderboard - Season 3</h1>
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

      <p style={{ color: "#333", marginTop: 6, fontSize: "0.95rem" }}>
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