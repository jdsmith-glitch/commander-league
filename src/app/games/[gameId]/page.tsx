"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, usePlayers, useGameAttendance } from "@/lib/hooks";

export default function GameDetailPage({ params }: { params: Promise<{ gameId: string }> }) {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [game, setGame] = useState<any>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  useEffect(() => {
    params.then((p) => setGameId(p.gameId));
  }, [params]);

  const { authReady, leagueId } = useAuth(sb);
  const { players } = usePlayers(sb, leagueId);
  const { activePlayerIds, toggle, selectAll, clearAll, carryFromPrevious } = useGameAttendance(sb, gameId);

  useEffect(() => {
    if (!sb || !gameId) return;

    const loadGame = async () => {
      try {
        const { data, error: err } = await sb
          .from("games")
          .select("id,game_number,season_id,locked")
          .eq("id", gameId)
          .single();

        if (err) throw err;
        setGame(data);
      } catch (err: any) {
        setError(err.message);
      }
    };

    loadGame();
  }, [sb, gameId]);

  async function handleToggleLock() {
    if (!game || !sb || !gameId) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await sb.from("games").update({ locked: !game.locked }).eq("id", gameId);
      if (err) throw err;
      setGame({ ...game, locked: !game.locked });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    window.location.href = "/login";
  }

  if (!sb || !authReady || !game) {
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
        <h1>Game {game.game_number}</h1>
        <button
          onClick={() => (window.location.href = `/games`)}
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
          ← Back to Games
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p>}

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span>
          Status: <b>{game.locked ? "Locked" : "Open"}</b>
        </span>
        <button
          onClick={handleToggleLock}
          disabled={loading}
          style={{
            color: "#1d4ed8",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: loading ? "not-allowed" : "pointer",
            textDecoration: "underline",
            font: "inherit",
          }}
        >
          {game.locked ? "Unlock Game" : "Lock Game"}
        </button>
      </div>

      <section style={{ marginTop: 30 }}>
        <h2>Attendance</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => selectAll(players.map((p) => p.id))}
            disabled={!!game.locked}
            style={{
              color: game.locked ? "#93c5fd" : "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: game.locked ? "not-allowed" : "pointer",
              textDecoration: "underline",
              font: "inherit",
            }}
          >
            Select All
          </button>
          <button
            onClick={() => clearAll()}
            disabled={!!game.locked}
            style={{
              color: game.locked ? "#93c5fd" : "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: game.locked ? "not-allowed" : "pointer",
              textDecoration: "underline",
              font: "inherit",
            }}
          >
            Clear All
          </button>
          <button
            onClick={() => carryFromPrevious()}
            disabled={!!game.locked}
            style={{
              color: game.locked ? "#93c5fd" : "#166534",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: game.locked ? "not-allowed" : "pointer",
              textDecoration: "underline",
              font: "inherit",
              fontWeight: "bold",
            }}
          >
            📋 Carry from Previous Game
          </button>
          <span style={{ color: "#555" }}>
            Active: <b>{activePlayerIds.length}</b>
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
          {players.map((p) => {
            const checked = activePlayerIds.includes(p.id);
            return (
              <label
                key={p.id}
                style={{
                  border: "1px solid #ddd",
                  padding: 10,
                  borderRadius: 8,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  opacity: game.locked ? 0.7 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!!game.locked}
                  onChange={() => toggle(p.id)}
                />
                <span>{p.name}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 30 }}>
        <h2>Pods & Results</h2>
        <p style={{ color: "#555" }}>
          Once you've set attendance, manage pods and enter game results.
        </p>
        <button
          onClick={() => (window.location.href = `/games/${gameId}/pods`)}
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
          Manage Pods & Results →
        </button>
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