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
    <main style={{ padding: 30, fontFamily: "sans-serif", maxWidth: 1100 }}>
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

      <p style={{ color: "#555", marginTop: 6 }}>
        Scoring: Win {SCORING.win}, Draw {SCORING.draw}, Loss {SCORING.loss}, No-show {SCORING.noShow}. Byes count as wins.
      </p>

      {players.length === 0 ? (
        <p>No players yet.</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 20 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb" }}>
                {["Rank", "Player", "Points", "W", "D", "L", "Byes", "No-shows", "Played"].map((h) => (
                  <th
                    key={h}
                    style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: "12px 6px", fontWeight: "600" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, i) => (
                <tr key={row.playerId} style={{ backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>
                    <b>{i + 1}</b>
                  </td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{row.name}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>
                    <b>{row.points}</b>
                  </td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{row.wins}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{row.draws}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{row.losses}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{row.byes}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{row.noShows}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{row.played}</td>
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