"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGames, usePlayers } from "@/lib/hooks";

export default function DashboardPage() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  const { authReady, leagueId, error: authError } = useAuth(sb);
  const { games, loading: gamesLoading } = useGames(sb, "6eb519c9-faf4-4f03-94f5-b85a32bc2c62"); // Season 3 ID
  const { players, loading: playersLoading } = usePlayers(sb, leagueId);

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
        <h1>Commander League Manager</h1>
        <p style={{ color: "#b91c1c" }}>No league found for your account.</p>
        <button onClick={signOut}>Sign out</button>
      </main>
    );
  }

  if (authError) {
    return (
      <main style={{ padding: 30, fontFamily: "sans-serif" }}>
        <h1>Error</h1>
        <p style={{ color: "#b91c1c" }}>{authError}</p>
        <button onClick={signOut}>Sign out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 30, fontFamily: "sans-serif", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Commander League Manager</h1>
        <button
          onClick={signOut}
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
          Sign out
        </button>
      </div>

      <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {/* Players Card */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 20 }}>
          <h2 style={{ fontSize: "1.25rem", marginTop: 0 }}>Players</h2>
          <p style={{ color: "#555", margin: 0 }}>
            {playersLoading ? "Loading..." : `${players.length} players registered`}
          </p>
          <button
            onClick={() => (window.location.href = "/players")}
            style={{
              marginTop: 12,
              color: "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              font: "inherit",
              fontSize: "1rem",
            }}
          >
            Manage Players →
          </button>
        </div>

        {/* Games Card */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 20 }}>
          <h2 style={{ fontSize: "1.25rem", marginTop: 0 }}>Season 3 Games</h2>
          <p style={{ color: "#555", margin: 0 }}>
            {gamesLoading ? "Loading..." : `${games.length} games`}
          </p>
          <button
            onClick={() => (window.location.href = "/games")}
            style={{
              marginTop: 12,
              color: "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              font: "inherit",
              fontSize: "1rem",
            }}
          >
            Manage Games →
          </button>
        </div>

        {/* Leaderboard Card */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 20 }}>
          <h2 style={{ fontSize: "1.25rem", marginTop: 0 }}>Leaderboard</h2>
          <p style={{ color: "#555", margin: 0 }}>Live season standings</p>
          <button
            onClick={() => (window.location.href = "/leaderboard")}
            style={{
              marginTop: 12,
              color: "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              font: "inherit",
              fontSize: "1rem",
            }}
          >
            View Leaderboard →
          </button>
        </div>

        {/* Admin Card */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 20 }}>
          <h2 style={{ fontSize: "1.25rem", marginTop: 0 }}>Admin</h2>
          <p style={{ color: "#555", margin: 0 }}>Manage administrators</p>
          <button
            onClick={() => (window.location.href = "/admin")}
            style={{
              marginTop: 12,
              color: "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              font: "inherit",
              fontSize: "1rem",
            }}
          >
            Manage Admins →
          </button>
        </div>
      </div>
    </main>
  );
}