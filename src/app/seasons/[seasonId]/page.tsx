"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

export default function SeasonDetailPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [season, setSeason] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setSeasonId(p.seasonId));
  }, [params]);

  useEffect(() => {
    if (!seasonId) return;

    const load = async () => {
      try {
        setLoading(true);
        const { getSupabaseClient } = await import("@/lib/supabaseClient");
        const sb = getSupabaseClient();

        const [seasonRes, gamesRes] = await Promise.all([
          sb.from("seasons").select("*").eq("id", seasonId).single(),
          sb.from("games").select("*").eq("season_id", seasonId).order("game_number"),
        ]);

        if (seasonRes.error) throw seasonRes.error;
        if (gamesRes.error) throw gamesRes.error;

        setSeason(seasonRes.data);
        setGames(gamesRes.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [seasonId]);

  if (loading) return <main style={{ padding: 30 }}>Loading...</main>;
  if (error) return <main style={{ padding: 30 }}>Error: {error}</main>;
  if (!season) return <main style={{ padding: 30 }}>Season not found</main>;

  return (
    <main style={{ padding: 30, maxWidth: 1100 }}>
      <h1>{season.name}</h1>
      <button onClick={() => (window.location.href = "/seasons")}>← Back</button>

      <button onClick={() => alert("Add game feature coming soon")} style={{ marginTop: 20 }}>
        + Add Game
      </button>

      <h2 style={{ marginTop: 20 }}>Games ({games.length})</h2>
      {games.length === 0 ? (
        <p>No games</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {games.map((game) => (
            <div key={game.id} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 8 }}>
              <h3>Game {game.game_number}</h3>
              <p>{game.locked ? "Locked" : "Open"}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}