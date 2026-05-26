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

  const currentSeason = seasons.find((s) => s.id === selectedSeasonId);

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
            font: "inheri