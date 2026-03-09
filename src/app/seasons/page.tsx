"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useGames } from "@/lib/hooks";

export default function SeasonDetailPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [season, setSeason] = useState<any>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  useEffect(() => {
    params.then((p) => {
      setSeasonId(p.seasonId);
    });
  }, [params]);

  const { authReady, leagueId } = useAuth(sb);
  const { games, error: gamesError, add: addGame } = useGames(sb, seasonId);

  useEffect(() => {
    if (!sb || !seasonId) return;

    const loadSeason = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await sb
          .from("seasons")
          .select("id,name")
          .eq("id", seasonId)
          .single();

        if (err) throw err;
        setSeason(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSeason();
  }, [sb, seasonId]);

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

  if (loading || !season) {
    return <main style={{ padding: 30, fontFamily: "sans-serif" }}>Loading season…</main>;
  }

  if (error) {
    return (
      <main style={{ padding: 30, fontFamily: "sans-serif" }}>
        <h1>Error</h1>
        <p style={{ color: "#b91c1c" }}>{error}</p>
        <button onClick={() => (window.location.href = "/seasons")}>Back to Seasons</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 30, fontFamily: "sans-serif", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{season.name}</h1>
        <button
          onClick={() => (window.location.href = "/seasons")}
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
          ← Back to Seasons
        </button>
      </div>

      {gamesError && <p style={{ color: "#b91c1c", marginTop: 10 }}>{gamesError}</p>}

      <section style={{ marginTop: 20 }}>
        <button
          onClick={() => addGame()}
          style={{
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
          + Add Game
        </button>
      </section>

      <section style={{ marginTop: 30 }}>
        <h2>Games in {season.name}</h2>
        {games.length === 0 ? (
          <p style={{ color: "#555" }}>No games yet. Create your first game above.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {games.map((game) => (
              <div
                key={game.id}
                onClick={() => (window.location.href = `/seasons/${seasonId}/games/${game.id}`)}
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